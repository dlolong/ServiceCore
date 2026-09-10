const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);

export const REMOTE_DEVELOPMENT_CONFIRMATION = "NEGOSU_NON_PRODUCTION_QA_ONLY";

export type QaSeedMode = "dry-run" | "apply";

export type QaSeedSafetyInput = {
  mode: QaSeedMode;
  supabaseUrl: string | undefined;
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
  qaSeedTarget: string | undefined;
  allowRemoteDevelopment: string | undefined;
  confirmation: string | undefined;
};

export type QaSeedSafetyResult = {
  target: "local" | "remote-development";
  mode: QaSeedMode;
};

function parseSupabaseUrl(value: string | undefined) {
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for the QA persona seed.");

  try {
    return new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
}

/**
 * Fail closed before a service-role client is created. Local Supabase is the
 * default target; a remote development project needs three explicit guards.
 */
export function assertQaSeedSafety(input: QaSeedSafetyInput): QaSeedSafetyResult {
  const url = parseSupabaseUrl(input.supabaseUrl);
  const productionRuntime = input.nodeEnv === "production" || input.vercelEnv === "production";

  if (productionRuntime || input.qaSeedTarget === "production") {
    throw new Error("QA persona seeding is disabled in production.");
  }

  if (LOCAL_HOSTNAMES.has(url.hostname)) {
    return { target: "local", mode: input.mode };
  }

  const explicitlyAllowed = input.qaSeedTarget === "development"
    && input.allowRemoteDevelopment === "true"
    && input.confirmation === REMOTE_DEVELOPMENT_CONFIRMATION;

  if (!explicitlyAllowed) {
    throw new Error(
      "Remote QA seeding is blocked. Use a dedicated development project and set "
      + "QA_SEED_TARGET=development, QA_SEED_ALLOW_REMOTE_DEVELOPMENT=true, and the documented confirmation value.",
    );
  }

  return { target: "remote-development", mode: input.mode };
}

export function parseQaSeedMode(arguments_: readonly string[]): QaSeedMode {
  const apply = arguments_.includes("--apply");
  const dryRun = arguments_.includes("--dry-run");

  if (apply && dryRun) throw new Error("Choose either --dry-run or --apply, not both.");
  return apply ? "apply" : "dry-run";
}

export function formatQaSeedOperatorError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
  const code = typeof candidate?.code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(candidate.code)
    ? candidate.code
    : "QA_SEED_ERROR";
  const rawMessage = typeof candidate?.message === "string"
    ? candidate.message
    : error instanceof Error ? error.message : "Unknown QA seed failure.";
  const message = rawMessage
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/(password|secret|token|authorization|apikey|api_key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  return { code, message: message || "Unknown QA seed failure." };
}

export type QaMembershipRecord = { id: string; userId: string };
export type QaMembershipStrategy =
  | "INSERT_FIXED_SLOT"
  | "REASSIGN_FIXED_SLOT"
  | "ACTIVATE_USER_MEMBERSHIP"
  | "ACTIVATE_USER_AND_DEACTIVATE_STALE_SLOT";

export function resolveQaMembershipStrategy(
  fixedSlot: QaMembershipRecord | null,
  userMembership: QaMembershipRecord | null,
): QaMembershipStrategy {
  if (userMembership) {
    return fixedSlot && fixedSlot.id !== userMembership.id
      ? "ACTIVATE_USER_AND_DEACTIVATE_STALE_SLOT"
      : "ACTIVATE_USER_MEMBERSHIP";
  }
  return fixedSlot ? "REASSIGN_FIXED_SLOT" : "INSERT_FIXED_SLOT";
}
