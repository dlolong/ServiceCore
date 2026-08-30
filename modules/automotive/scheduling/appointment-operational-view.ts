import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { KarKRAppointmentAssignmentContext } from "@/modules/automotive/scheduling/appointment-operational-view.model";
export { assignmentContextLabel } from "@/modules/automotive/scheduling/appointment-operational-view.model";


export async function loadKarKRAppointmentAssignmentContext(organizationId: string, appointmentIds: string[]) {
  const empty = new Map<string, KarKRAppointmentAssignmentContext>();
  for (const appointmentId of appointmentIds) empty.set(appointmentId, { scheduledStaff: [], scheduledResources: [] });
  if (!appointmentIds.length) return empty;

  const supabase = await createClient();
  const [{ data: staffAssignments }, { data: resourceAssignments }] = await Promise.all([
    supabase.from("appointment_staff_assignments").select("appointment_id,staff_membership_id,organization_memberships(user_id,role,is_active,profiles(full_name))").eq("organization_id", organizationId).in("appointment_id", appointmentIds),
    supabase.from("appointment_resource_assignments").select("appointment_id,resource_id,scheduling_resources(name,resource_type)").eq("organization_id", organizationId).in("appointment_id", appointmentIds),
  ]);

  for (const assignment of staffAssignments ?? []) {
    const membership = Array.isArray(assignment.organization_memberships) ? assignment.organization_memberships[0] : assignment.organization_memberships;
    const profile = Array.isArray(membership?.profiles) ? membership.profiles[0] : membership?.profiles;
    empty.get(assignment.appointment_id)?.scheduledStaff.push({
      id: assignment.staff_membership_id,
      displayName: profile?.full_name ?? "Staff member",
      canInitializeJobOrder: Boolean(membership?.is_active && membership.role === "technician"),
    });
  }
  for (const assignment of resourceAssignments ?? []) {
    const resource = Array.isArray(assignment.scheduling_resources) ? assignment.scheduling_resources[0] : assignment.scheduling_resources;
    if (resource) empty.get(assignment.appointment_id)?.scheduledResources.push({ id: assignment.resource_id, name: resource.name, type: resource.resource_type });
  }
  return empty;
}
