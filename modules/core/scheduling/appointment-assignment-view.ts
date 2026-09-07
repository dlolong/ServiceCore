import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isMissingAppointmentStaffProfileId } from "@/lib/supabase/schema-compatibility";
import { listOperationalStaffDirectory } from "@/modules/core/staff/staff.runtime";

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
  const [staffResult, resourceResult] = await Promise.all([
    supabase.from("appointment_staff_assignments").select("appointment_id,staff_profile_id,organization_staff_profiles(full_name)").eq("organization_id", organizationId).in("appointment_id", appointmentIds),
    supabase.from("appointment_resource_assignments").select("appointment_id,resource_id,scheduling_resources(name,resource_type)").eq("organization_id", organizationId).in("appointment_id", appointmentIds),
  ]);
  if (resourceResult.error) throw new Error("Unable to load appointment resource assignments.");

  let staffAssignments: Array<{ appointmentId: string; staffId: string; displayName: string }>;
  if (!staffResult.error) {
    staffAssignments = (staffResult.data ?? []).map((assignment) => {
      const profile = Array.isArray(assignment.organization_staff_profiles) ? assignment.organization_staff_profiles[0] : assignment.organization_staff_profiles;
      return { appointmentId: assignment.appointment_id, staffId: assignment.staff_profile_id, displayName: profile?.full_name ?? "Staff member" };
    });
  } else {
    if (!isMissingAppointmentStaffProfileId(staffResult.error)) throw new Error("Unable to load appointment Staff assignments.");
    const legacyResult = await supabase.from("appointment_staff_assignments")
      .select("appointment_id,staff_membership_id")
      .eq("organization_id", organizationId)
      .in("appointment_id", appointmentIds);
    if (legacyResult.error) throw new Error("Unable to load appointment Staff assignments.");
    const legacyRows = legacyResult.data ?? [];
    const staffDirectory = legacyRows.length ? await listOperationalStaffDirectory(organizationId) : [];
    const staffNames = new Map(staffDirectory.map((staff) => [staff.staffId, staff.fullName]));
    staffAssignments = legacyRows.map((assignment) => ({
      appointmentId: assignment.appointment_id,
      staffId: assignment.staff_membership_id,
      displayName: staffNames.get(assignment.staff_membership_id) ?? "Staff member",
    }));
  }

  for (const assignment of staffAssignments) {
    result.get(assignment.appointmentId)?.scheduledStaff.push({ id: assignment.staffId, displayName: assignment.displayName });
  }
  for (const assignment of resourceResult.data ?? []) {
    const resource = Array.isArray(assignment.scheduling_resources) ? assignment.scheduling_resources[0] : assignment.scheduling_resources;
    if (resource) result.get(assignment.appointment_id)?.scheduledResources.push({ id: assignment.resource_id, name: resource.name, type: resource.resource_type });
  }
  return result;
}
