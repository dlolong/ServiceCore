import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AppointmentAssignmentContext = {
  scheduledStaff: Array<{ id: string; displayName: string }>;
  scheduledResources: Array<{ id: string; name: string; type: string | null }>;
};

export function assignmentContextLabel(context: AppointmentAssignmentContext) {
  return {
    staff: context.scheduledStaff.map(({ displayName }) => displayName).join(", ") || "Unassigned",
    resources: context.scheduledResources.map(({ name }) => name).join(", ") || "Unassigned",
  };
}

export async function loadAppointmentAssignmentContext(organizationId: string, appointmentIds: string[]) {
  const result = new Map<string, AppointmentAssignmentContext>();
  for (const appointmentId of appointmentIds) result.set(appointmentId, { scheduledStaff: [], scheduledResources: [] });
  if (!appointmentIds.length) return result;
  const supabase = await createClient();
  const [{ data: staffAssignments }, { data: resourceAssignments }] = await Promise.all([
    supabase.from("appointment_staff_assignments").select("appointment_id,staff_profile_id,organization_staff_profiles(full_name)").eq("organization_id", organizationId).in("appointment_id", appointmentIds),
    supabase.from("appointment_resource_assignments").select("appointment_id,resource_id,scheduling_resources(name,resource_type)").eq("organization_id", organizationId).in("appointment_id", appointmentIds),
  ]);
  for (const assignment of staffAssignments ?? []) {
    const profile = Array.isArray(assignment.organization_staff_profiles) ? assignment.organization_staff_profiles[0] : assignment.organization_staff_profiles;
    result.get(assignment.appointment_id)?.scheduledStaff.push({ id: assignment.staff_profile_id, displayName: profile?.full_name ?? "Staff member" });
  }
  for (const assignment of resourceAssignments ?? []) {
    const resource = Array.isArray(assignment.scheduling_resources) ? assignment.scheduling_resources[0] : assignment.scheduling_resources;
    if (resource) result.get(assignment.appointment_id)?.scheduledResources.push({ id: assignment.resource_id, name: resource.name, type: resource.resource_type });
  }
  return result;
}
