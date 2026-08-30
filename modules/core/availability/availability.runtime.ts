import "server-only";

import { createClient } from "@/lib/supabase/server";
import { blockingAppointmentStatuses, type AvailabilityDependencies } from "@/modules/core/availability/availability.service";

export const availabilityDependencies: AvailabilityDependencies = {
  async loadContext(input) {
    const supabase = await createClient();
    const staffIds = input.staffAssignments.map(({ staffId }) => staffId);
    const resourceIds = input.resourceAssignments.map(({ resourceId }) => resourceId);
    const [{ data: branch }, { data: services }, { data: branchAvailability }, { data: staff }, { data: staffBranches }, { data: resources }] = await Promise.all([
      supabase.from("branches").select("timezone,opening_hours").eq("id", input.branchId).eq("organization_id", input.organizationId).eq("is_active", true).maybeSingle(),
      supabase.from("services").select("id,duration_minutes").eq("organization_id", input.organizationId).eq("is_active", true).in("id", input.serviceIds),
      supabase.from("service_branch_availability").select("service_id,branch_id,is_available").eq("organization_id", input.organizationId).in("service_id", input.serviceIds),
      staffIds.length ? supabase.from("organization_memberships").select("id,is_active,role").eq("organization_id", input.organizationId).in("id", staffIds) : Promise.resolve({ data: [] }),
      staffIds.length ? supabase.from("membership_branch_assignments").select("membership_id,branch_id").eq("organization_id", input.organizationId).in("membership_id", staffIds) : Promise.resolve({ data: [] }),
      resourceIds.length ? supabase.from("scheduling_resources").select("id,branch_id,capacity,is_active").eq("organization_id", input.organizationId).in("id", resourceIds) : Promise.resolve({ data: [] }),
    ]);
    const configuredServices = new Set((branchAvailability ?? []).map((row) => row.service_id));
    const serviceRows = (services ?? []).map((service) => ({ id: service.id, durationMinutes: service.duration_minutes, available: !configuredServices.has(service.id) || (branchAvailability ?? []).some((row) => row.service_id === service.id && row.branch_id === input.branchId && row.is_available) }));
    const durationMinutes = serviceRows.reduce((total, service) => total + service.durationMinutes, 0);
    const end = new Date(new Date(input.scheduledStart).valueOf() + Math.max(durationMinutes, 1) * 60_000);
    let query = supabase.from("appointments").select("id,starts_at,ends_at").eq("organization_id", input.organizationId).eq("branch_id", input.branchId).in("status", [...blockingAppointmentStatuses]).lt("starts_at", end.toISOString()).gt("ends_at", input.scheduledStart).limit(100);
    if (input.appointmentId) query = query.neq("id", input.appointmentId);
    const { data: appointments } = await query;
    const appointmentIds = (appointments ?? []).map(({ id }) => id);
    const [{ data: staffAssignments }, { data: resourceAssignments }] = await Promise.all([
      staffIds.length && appointmentIds.length ? supabase.from("appointment_staff_assignments").select("staff_membership_id,appointment_id").in("staff_membership_id", staffIds).in("appointment_id", appointmentIds) : Promise.resolve({ data: [] }),
      resourceIds.length && appointmentIds.length ? supabase.from("appointment_resource_assignments").select("resource_id,appointment_id,quantity").in("resource_id", resourceIds).in("appointment_id", appointmentIds) : Promise.resolve({ data: [] }),
    ]);
    const appointmentById = new Map((appointments ?? []).map((appointment) => [appointment.id, appointment]));
    return {
      branch: branch ? { timezone: branch.timezone, openingHours: branch.opening_hours as Record<string, { open?: string; close?: string; closed?: boolean }> } : null,
      services: serviceRows,
      appointments: (appointments ?? []).filter((appointment): appointment is { id: string; starts_at: string; ends_at: string } => Boolean(appointment.starts_at && appointment.ends_at)).map((appointment) => ({ id: appointment.id, startsAt: appointment.starts_at, endsAt: appointment.ends_at })),
      staff: (staff ?? []).map((member) => { const assignedBranches = (staffBranches ?? []).filter((assignment) => assignment.membership_id === member.id); return { id: member.id, available: member.is_active, allowedAtBranch: member.role === "owner" || assignedBranches.length === 0 || assignedBranches.some((assignment) => assignment.branch_id === input.branchId) }; }),
      staffOccupancy: (staffAssignments ?? []).flatMap((assignment) => { const appointment = appointmentById.get(assignment.appointment_id); return appointment?.starts_at && appointment.ends_at ? [{ staffId: assignment.staff_membership_id, appointmentId: assignment.appointment_id, startsAt: appointment.starts_at, endsAt: appointment.ends_at }] : []; }),
      resources: (resources ?? []).map((resource) => ({ id: resource.id, capacity: resource.capacity, active: resource.is_active, atBranch: resource.branch_id === input.branchId })),
      resourceOccupancy: (resourceAssignments ?? []).flatMap((assignment) => { const appointment = appointmentById.get(assignment.appointment_id); return appointment?.starts_at && appointment.ends_at ? [{ resourceId: assignment.resource_id, appointmentId: assignment.appointment_id, startsAt: appointment.starts_at, endsAt: appointment.ends_at, quantity: assignment.quantity }] : []; }),
    };
  },
};
