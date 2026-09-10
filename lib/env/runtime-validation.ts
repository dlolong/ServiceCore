export const environmentClassifications = [
  "REQUIRED_IN_ALL_ENVIRONMENTS",
  "REQUIRED_IN_PRODUCTION",
  "OPTIONAL_PROVIDER",
  "TEST_ONLY",
] as const;

export type EnvironmentClassification = (typeof environmentClassifications)[number];

export type EnvironmentVariableDefinition = {
  classification: EnvironmentClassification;
  purpose: string;
  secret: boolean;
};

/**
 * Inventory of environment variables that are consumed by the repository.
 * Values are deliberately absent so diagnostics can never disclose secrets.
 */
export const environmentVariableCatalog = {
  NODE_ENV: { classification: "REQUIRED_IN_ALL_ENVIRONMENTS", purpose: "Selects development, test, or production safety behavior.", secret: false },
  NEXT_PUBLIC_APP_URL: { classification: "REQUIRED_IN_PRODUCTION", purpose: "Builds trusted application redirects and public links.", secret: false },
  NEXT_PUBLIC_SUPABASE_URL: { classification: "REQUIRED_IN_PRODUCTION", purpose: "Connects browser and server Supabase clients.", secret: false },
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: { classification: "REQUIRED_IN_PRODUCTION", purpose: "Authenticates public Supabase client requests; this key is intentionally public.", secret: false },
  SUPABASE_SERVICE_ROLE_KEY: { classification: "REQUIRED_IN_PRODUCTION", purpose: "Runs narrowly scoped billing, notification, and administrative server operations.", secret: true },
  STRIPE_SECRET_KEY: { classification: "OPTIONAL_PROVIDER", purpose: "Creates Stripe Checkout and customer portal sessions.", secret: true },
  STRIPE_WEBHOOK_SECRET: { classification: "OPTIONAL_PROVIDER", purpose: "Verifies Stripe webhook signatures.", secret: true },
  BILLING_RECONCILIATION_SECRET: { classification: "OPTIONAL_PROVIDER", purpose: "Protects the billing reconciliation endpoint.", secret: true },
  NOTIFICATION_LINK_ENCRYPTION_KEY: { classification: "OPTIONAL_PROVIDER", purpose: "Encrypts private notification delivery links at rest.", secret: true },
  NOTIFICATION_CRON_SECRET: { classification: "OPTIONAL_PROVIDER", purpose: "Protects the notification scheduler endpoint.", secret: true },
  EMAIL_PROVIDER: { classification: "OPTIONAL_PROVIDER", purpose: "Selects the configured email delivery adapter.", secret: false },
  SMS_PROVIDER: { classification: "OPTIONAL_PROVIDER", purpose: "Selects the configured SMS delivery adapter.", secret: false },
  RESEND_API_KEY: { classification: "OPTIONAL_PROVIDER", purpose: "Authenticates the optional email provider.", secret: true },
  TWILIO_ACCOUNT_SID: { classification: "OPTIONAL_PROVIDER", purpose: "Identifies the optional SMS provider account.", secret: true },
  TWILIO_AUTH_TOKEN: { classification: "OPTIONAL_PROVIDER", purpose: "Authenticates the optional SMS provider account.", secret: true },
  OPENAI_API_KEY: { classification: "OPTIONAL_PROVIDER", purpose: "Authenticates optional AI features; normal operations do not depend on it.", secret: true },
  E2E_BASE_URL: { classification: "TEST_ONLY", purpose: "Points browser tests at a non-production application.", secret: false },
  E2E_AUTHENTICATED: { classification: "TEST_ONLY", purpose: "Enables authenticated browser-test scenarios.", secret: false },
  PLAYWRIGHT_CHROME_PATH: { classification: "TEST_ONLY", purpose: "Selects a local browser binary for Playwright.", secret: false },
  QA_SEED_TARGET: { classification: "TEST_ONLY", purpose: "Selects the explicitly guarded QA seed target.", secret: false },
  QA_SEED_ALLOW_REMOTE_DEVELOPMENT: { classification: "TEST_ONLY", purpose: "Acknowledges an explicitly scoped remote development seed target.", secret: false },
  QA_SEED_CONFIRM: { classification: "TEST_ONLY", purpose: "Confirms the destructive-safe QA seed operation.", secret: false },
  QA_AUTOMOTIVE_OWNER_EMAIL: { classification: "TEST_ONLY", purpose: "Creates the deterministic Automotive QA persona.", secret: false },
  QA_SALON_OWNER_EMAIL: { classification: "TEST_ONLY", purpose: "Creates the deterministic Salon QA persona.", secret: false },
  QA_OWNER_PASSWORD: { classification: "TEST_ONLY", purpose: "Authenticates non-production QA personas.", secret: true },
} as const satisfies Record<string, EnvironmentVariableDefinition>;

export type RuntimeEnvironmentName = keyof typeof environmentVariableCatalog;

export type EnvironmentValidationIssue = {
  variable: RuntimeEnvironmentName;
  classification: EnvironmentClassification;
  purpose: string;
  reason: string;
};

export type EnvironmentValidationReport = {
  environment: "development" | "test" | "production";
  valid: boolean;
  issues: EnvironmentValidationIssue[];
};

export class RuntimeEnvironmentValidationError extends Error {
  constructor(public readonly issues: EnvironmentValidationIssue[]) {
    super(`Invalid runtime configuration: ${issues.map(({ variable, reason, purpose }) => `${variable} (${reason}). Purpose: ${purpose}`).join(" ")}`);
    this.name = "RuntimeEnvironmentValidationError";
  }
}

type EnvironmentSource = Record<string, string | undefined>;

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function issue(variable: RuntimeEnvironmentName, reason: string): EnvironmentValidationIssue {
  const definition = environmentVariableCatalog[variable];
  return { variable, classification: definition.classification, purpose: definition.purpose, reason };
}

function validUrl(value: string | undefined) {
  if (!configured(value)) return false;
  try {
    const parsed = new URL(value!);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalUrl(value: string | undefined) {
  if (!configured(value)) return false;
  try {
    const hostname = new URL(value!).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/** Pure validator reused by release tooling and import-time application guards. */
export function validateRuntimeEnvironment(source: EnvironmentSource): EnvironmentValidationReport {
  const environment = source.NODE_ENV === "production" ? "production" : source.NODE_ENV === "test" ? "test" : "development";
  const issues: EnvironmentValidationIssue[] = [];

  if (!configured(source.NODE_ENV)) issues.push(issue("NODE_ENV", "is missing"));

  if (environment === "production") {
    for (const variable of [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ] as const) {
      if (!configured(source[variable])) issues.push(issue(variable, "is required in production"));
    }
  }

  for (const variable of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const) {
    if (configured(source[variable]) && !validUrl(source[variable])) issues.push(issue(variable, "must be an HTTP(S) URL"));
  }
  if (environment === "production" && isLocalUrl(source.NEXT_PUBLIC_APP_URL)) {
    issues.push(issue("NEXT_PUBLIC_APP_URL", "must not point to localhost in production"));
  }

  const stripeConfigured = configured(source.STRIPE_SECRET_KEY)
    || configured(source.STRIPE_WEBHOOK_SECRET)
    || configured(source.BILLING_RECONCILIATION_SECRET);
  if (stripeConfigured && !configured(source.STRIPE_SECRET_KEY)) issues.push(issue("STRIPE_SECRET_KEY", "is required when Stripe billing is enabled"));
  if (stripeConfigured && !configured(source.STRIPE_WEBHOOK_SECRET)) issues.push(issue("STRIPE_WEBHOOK_SECRET", "is required when Stripe billing is enabled"));
  if (stripeConfigured && !configured(source.BILLING_RECONCILIATION_SECRET)) issues.push(issue("BILLING_RECONCILIATION_SECRET", "is required when Stripe billing is enabled"));

  const twilioConfigured = configured(source.TWILIO_ACCOUNT_SID) || configured(source.TWILIO_AUTH_TOKEN);
  if (twilioConfigured && !configured(source.TWILIO_ACCOUNT_SID)) issues.push(issue("TWILIO_ACCOUNT_SID", "is required when Twilio is enabled"));
  if (twilioConfigured && !configured(source.TWILIO_AUTH_TOKEN)) issues.push(issue("TWILIO_AUTH_TOKEN", "is required when Twilio is enabled"));

  if (environment === "production") {
    for (const variable of ["EMAIL_PROVIDER", "SMS_PROVIDER"] as const) {
      if (source[variable] === "console") issues.push(issue(variable, "cannot use the console provider in production"));
    }
    for (const variable of [
      "E2E_BASE_URL",
      "E2E_AUTHENTICATED",
      "PLAYWRIGHT_CHROME_PATH",
      "QA_SEED_TARGET",
      "QA_SEED_ALLOW_REMOTE_DEVELOPMENT",
      "QA_SEED_CONFIRM",
      "QA_AUTOMOTIVE_OWNER_EMAIL",
      "QA_SALON_OWNER_EMAIL",
      "QA_OWNER_PASSWORD",
    ] as const) {
      if (configured(source[variable])) issues.push(issue(variable, "is test-only and must not be configured in production"));
    }
  }

  if (configured(source.NOTIFICATION_LINK_ENCRYPTION_KEY)) {
    let decodedBytes = 0;
    try { decodedBytes = Buffer.from(source.NOTIFICATION_LINK_ENCRYPTION_KEY!, "base64").length; } catch { decodedBytes = 0; }
    if (decodedBytes !== 32) issues.push(issue("NOTIFICATION_LINK_ENCRYPTION_KEY", "must be a base64-encoded 32-byte key"));
  }

  return { environment, valid: issues.length === 0, issues };
}

export function assertRuntimeEnvironment(source: EnvironmentSource) {
  const report = validateRuntimeEnvironment(source);
  if (!report.valid) throw new RuntimeEnvironmentValidationError(report.issues);
  return report;
}
