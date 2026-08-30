export type KarKRScheduledStaff = { id: string; displayName: string; canInitializeJobOrder: boolean };
export type KarKRScheduledResource = { id: string; name: string; type: string | null };
export type KarKRAppointmentAssignmentContext = { scheduledStaff: KarKRScheduledStaff[]; scheduledResources: KarKRScheduledResource[] };

export function assignmentContextLabel(context: KarKRAppointmentAssignmentContext) {
  return {
    staff: context.scheduledStaff.map(({ displayName }) => displayName).join(", ") || "Unassigned",
    resources: context.scheduledResources.map(({ name }) => name).join(", ") || "Unassigned",
  };
}
