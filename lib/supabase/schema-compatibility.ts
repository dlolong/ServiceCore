export type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null;

function databaseErrorText(error: DatabaseError) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
}

/** Rolling-deployment guard for migration 0054 only. */
export function isMissingCommandCenterMetrics(error: DatabaseError) {
  const missingFunction = error?.code === "PGRST202" || error?.code === "42883";
  return missingFunction && databaseErrorText(error).includes("get_command_center_shared_metrics");
}

/** Rolling-deployment guard for canonical Automotive Staff columns from 0055. */
export function isMissingCanonicalAutomotiveStaffColumn(error: DatabaseError) {
  const missingColumn = error?.code === "PGRST204" || error?.code === "42703";
  const text = databaseErrorText(error);
  return missingColumn && (
    text.includes("primary_technician_staff_id")
    || text.includes("technician_staff_id")
  );
}

/** Rolling-deployment guard for the Staff directory introduced by 0055. */
export function isMissingStaffDirectory(error: DatabaseError) {
  const missingRelation = error?.code === "PGRST205" || error?.code === "42P01";
  return missingRelation && databaseErrorText(error).includes("staff_directory");
}

/** Rolling-deployment guard for independent Staff management from 0055. */
export function isMissingStaffProfilesRpc(error: DatabaseError) {
  const missingFunction = error?.code === "PGRST202" || error?.code === "42883";
  return missingFunction && databaseErrorText(error).includes("list_staff_profiles");
}

/** Rolling-deployment guard for Staff-identity RPCs introduced by 0055. */
export function isMissingOptionalStaffRpc(error: DatabaseError, functionName: string) {
  const missingFunction = error?.code === "PGRST202" || error?.code === "42883";
  return missingFunction && databaseErrorText(error).includes(functionName.toLowerCase());
}

/** Rolling-deployment guard for canonical Appointment Staff identity from 0055. */
export function isMissingAppointmentStaffProfileId(error: DatabaseError) {
  const text = databaseErrorText(error);
  if (error?.code === "PGRST200") return text.includes("relationship")
    && text.includes("appointment_staff_assignments")
    && text.includes("organization_staff_profiles");
  if (error?.code !== "PGRST204" && error?.code !== "42703") return false;
  return text.includes("appointment_staff_assignments") && text.includes("staff_profile_id");
}

/** Rolling-deployment guard for organization_staff_profiles.id from 0055. */
export function isMissingCanonicalStaffProfileId(error: DatabaseError) {
  if (error?.code !== "PGRST204" && error?.code !== "42703") return false;
  const text = databaseErrorText(error);
  return text.includes("organization_staff_profiles") && /(?:column\s+)?['\"`]?id['\"`]?/.test(text);
}

export function shouldUseLegacyAutomotiveWorkReads(errors: {
  jobs: DatabaseError;
  sessions: DatabaseError;
  actorProfile: DatabaseError;
}) {
  const checks = [
    { error: errors.jobs, missing: isMissingCanonicalAutomotiveStaffColumn(errors.jobs) },
    { error: errors.sessions, missing: isMissingCanonicalAutomotiveStaffColumn(errors.sessions) },
    { error: errors.actorProfile, missing: isMissingCanonicalStaffProfileId(errors.actorProfile) },
  ];
  return checks.some(({ missing }) => missing)
    && checks.every(({ error, missing }) => !error || missing);
}

export function shouldUseLegacyAutomotiveDirectoryReads(errors: {
  directory: DatabaseError;
  sessions: DatabaseError;
}) {
  const checks = [
    { error: errors.directory, missing: isMissingStaffDirectory(errors.directory) },
    { error: errors.sessions, missing: isMissingCanonicalAutomotiveStaffColumn(errors.sessions) },
  ];
  return checks.some(({ missing }) => missing)
    && checks.every(({ error, missing }) => !error || missing);
}
