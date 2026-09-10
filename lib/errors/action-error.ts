type ErrorLike = {
  name?: string;
  code?: string;
  cause?: unknown;
};

const controlledDomainErrors = new Set([
  "AutomotiveJobPartsError",
  "AutomotiveSchedulingError",
  "AutomotiveWorkExecutionError",
  "AutomotiveWorkTrackingError",
  "EstimateApprovalError",
  "IndustryAccessError",
  "InventoryReservationError",
  "SchedulingError",
  "StaffProfileError",
]);

const unsafeMessagePatterns = [
  /\bselect\b.+\bfrom\b/i,
  /\binsert\s+into\b/i,
  /\bupdate\b.+\bset\b/i,
  /\bdelete\s+from\b/i,
  /\bpostgres(?:ql)?\b/i,
  /\bpostgrest\b/i,
  /\bsupabase\b/i,
  /\brow-level security\b/i,
  /\bschema cache\b/i,
  /\b(?:PGRST|SQLSTATE)\d+/i,
  /\bpublic\.[a-z_]+/i,
  /\b(?:function|column|relation)\s+["'][^"']+["']/i,
];

function errorLike(error: unknown): ErrorLike {
  return typeof error === "object" && error !== null ? error as ErrorLike : {};
}

function diagnosticCode(error: unknown) {
  const direct = errorLike(error);
  if (typeof direct.code === "string") return direct.code;
  const cause = errorLike(direct.cause);
  return typeof cause.code === "string" ? cause.code : undefined;
}

export function isControlledUserFacingError(error: unknown): error is Error {
  return error instanceof Error
    && controlledDomainErrors.has(error.name)
    && error.message.length > 0
    && error.message.length <= 300
    && !unsafeMessagePatterns.some((pattern) => pattern.test(error.message));
}

export function normalizeActionError(error: unknown, fallback: string) {
  return isControlledUserFacingError(error) ? error.message : fallback;
}

/** Logs searchable, non-sensitive context and returns a customer-safe message. */
export function reportActionError(operation: string, error: unknown, fallback: string) {
  const details = errorLike(error);
  console.error("server_action.failure", {
    operation,
    category: typeof details.name === "string" ? details.name : "UnknownError",
    code: diagnosticCode(error),
  });
  return normalizeActionError(error, fallback);
}

