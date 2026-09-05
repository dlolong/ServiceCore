type DatabaseError = {
  code?: string;
  message?: string;
} | null;

export function isMissingOrganizationIndustry(error: DatabaseError) {
  return error?.code === "42703" && error.message?.includes("industry") === true;
}

export function isMissingSchedulingResources(error: DatabaseError) {
  const missingRelation = error?.code === "PGRST205" || error?.code === "42P01";
  return missingRelation && error?.message?.includes("scheduling_resources") === true;
}
