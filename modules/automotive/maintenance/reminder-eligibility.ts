export const maintenanceActiveAppointmentStatuses=["requested","confirmed","checked_in","queued"] as const;
export type MaintenanceAppointmentStatus=typeof maintenanceActiveAppointmentStatuses[number]|"completed"|"cancelled"|"no_show"|null;

export function isMaintenanceAppointmentActive(status:MaintenanceAppointmentStatus){
  return status!==null&&maintenanceActiveAppointmentStatuses.includes(status as typeof maintenanceActiveAppointmentStatuses[number]);
}

export type MaintenanceReminderEligibilityReason=
  |"MAINTENANCE_COMPLETED"|"VEHICLE_INACTIVE"|"ACTIVE_RELATED_APPOINTMENT"|"SNOOZED"
  |"LEGACY_BACKFILL_NOT_ACTIVATED"|"ALREADY_REMINDER_STAGE_SENT"|"ELIGIBLE";

export function evaluateMaintenanceReminderEligibility(input:{
  lifecycleStatus:string;vehicleArchived:boolean;appointmentStatus:MaintenanceAppointmentStatus;
  snoozedUntil:string|null;notificationsEnabled:boolean;stageAlreadySent?:boolean;now?:Date;
}):MaintenanceReminderEligibilityReason{
  if(input.lifecycleStatus!=="active")return"MAINTENANCE_COMPLETED";
  if(input.vehicleArchived)return"VEHICLE_INACTIVE";
  if(isMaintenanceAppointmentActive(input.appointmentStatus))return"ACTIVE_RELATED_APPOINTMENT";
  if(input.snoozedUntil&&new Date(input.snoozedUntil)>(input.now??new Date()))return"SNOOZED";
  if(!input.notificationsEnabled)return"LEGACY_BACKFILL_NOT_ACTIVATED";
  if(input.stageAlreadySent)return"ALREADY_REMINDER_STAGE_SENT";
  return"ELIGIBLE";
}
