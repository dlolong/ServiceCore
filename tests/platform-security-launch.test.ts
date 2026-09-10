import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertRuntimeEnvironment,
  environmentVariableCatalog,
  RuntimeEnvironmentValidationError,
  validateRuntimeEnvironment,
} from "../lib/env/runtime-validation";
import { normalizeActionError } from "../lib/errors/action-error";

const productionEnvironment = {
  NODE_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://app.negosu.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key",
  SUPABASE_SERVICE_ROLE_KEY: "server-secret",
};

test("production environment validation fails closed on critical configuration", () => {
  const report = validateRuntimeEnvironment({ NODE_ENV: "production" });
  assert.equal(report.valid, false);
  assert.deepEqual(
    new Set(report.issues.map(({ variable }) => variable)),
    new Set([
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]),
  );
  assert.equal(environmentVariableCatalog.SUPABASE_SERVICE_ROLE_KEY.secret, true);
  assert.equal(environmentVariableCatalog.QA_OWNER_PASSWORD.classification, "TEST_ONLY");
});

test("production environment validation rejects unsafe launch combinations", () => {
  const report = validateRuntimeEnvironment({
    ...productionEnvironment,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    STRIPE_SECRET_KEY: "stripe-secret",
    STRIPE_WEBHOOK_SECRET: "webhook-secret",
    EMAIL_PROVIDER: "console",
    QA_OWNER_PASSWORD: "must-never-appear",
  });
  assert.equal(report.valid, false);
  assert.deepEqual(
    new Set(report.issues.map(({ variable }) => variable)),
    new Set(["NEXT_PUBLIC_APP_URL", "BILLING_RECONCILIATION_SECRET", "EMAIL_PROVIDER", "QA_OWNER_PASSWORD"]),
  );
  assert.throws(
    () => assertRuntimeEnvironment({ ...productionEnvironment, QA_OWNER_PASSWORD: "must-never-appear" }),
    (error) => {
      assert.ok(error instanceof RuntimeEnvironmentValidationError);
      assert.doesNotMatch(error.message, /must-never-appear/);
      assert.match(error.message, /QA_OWNER_PASSWORD/);
      return true;
    },
  );
});

test("development remains usable while provider pairs are validated when enabled", () => {
  assert.equal(validateRuntimeEnvironment({ NODE_ENV: "development" }).valid, true);
  assert.equal(validateRuntimeEnvironment({ ...productionEnvironment }).valid, true);
  const billing = validateRuntimeEnvironment({
    NODE_ENV: "development",
    STRIPE_SECRET_KEY: "stripe-secret",
  });
  assert.deepEqual(
    new Set(billing.issues.map(({ variable }) => variable)),
    new Set(["STRIPE_WEBHOOK_SECRET", "BILLING_RECONCILIATION_SECRET"]),
  );
});

test("action errors preserve controlled domain guidance and hide infrastructure details", () => {
  const controlled = new Error("Branch not available.");
  controlled.name = "SchedulingError";
  assert.equal(normalizeActionError(controlled, "Could not save."), "Branch not available.");

  assert.equal(
    normalizeActionError({ code: "42501", message: "new row violates row-level security policy" }, "Could not save."),
    "Could not save.",
  );
  const disguisedInfrastructureError = new Error("PostgREST schema cache failed for public.appointments");
  disguisedInfrastructureError.name = "SchedulingError";
  assert.equal(normalizeActionError(disguisedInfrastructureError, "Could not save."), "Could not save.");
});

test("onboarding derives Staff progress from canonical optional profiles with an exact legacy fallback", () => {
  const source = readFileSync("lib/auth/onboarding-progress.ts", "utf8");
  const canonicalRead = source.slice(source.indexOf('const canonical ='), source.indexOf('if (!canonical.error)'));
  assert.ok(source.indexOf('from("organization_staff_profiles")') < source.lastIndexOf('from("organization_memberships")'));
  assert.match(canonicalRead, /\.from\("organization_staff_profiles"\)[\s\S]*?\.select\("id", \{ count: "exact" \}\)[\s\S]*?\.limit\(1\)/);
  assert.doesNotMatch(canonicalRead, /head: true/);
  assert.match(source, /membership_id\.is\.null,membership_id\.neq\.\$\{membership\.membershipId\}/);
  assert.match(source, /isMissingCanonicalStaffProfileId\(canonical\.error\)/);
  assert.match(source, /isMissingOrganizationStaffProfilesRelation\(canonical\.error\)/);
  assert.match(source, /\.neq\("user_id", userId\)/);
  assert.doesNotMatch(source, /staff:\s*otherStaff\s*>\s*0[\s\S]*organization_memberships[\s\S]*Promise\.all/);
});

test("high-value routes retain server industry and billing gates", () => {
  const automotiveLayouts = [
    "app/dashboard/bookings/layout.tsx",
    "app/dashboard/jobs/layout.tsx",
    "app/dashboard/my-work/layout.tsx",
    "app/dashboard/queue/layout.tsx",
    "app/dashboard/reminders/layout.tsx",
    "app/dashboard/vehicles/layout.tsx",
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.match(automotiveLayouts, /requireIndustryFeature\("booking_requests"\)/);
  assert.match(automotiveLayouts, /requireIndustryFeature\("job_orders"\)/);
  assert.match(automotiveLayouts, /requireAutomotiveContext/);
  assert.match(automotiveLayouts, /requireIndustryFeature\("queue"\)/);
  assert.match(automotiveLayouts, /requireIndustryFeature\("maintenance"\)/);
  assert.match(automotiveLayouts, /requireIndustryFeature\("vehicles"\)/);

  const billingPage = readFileSync("app/dashboard/settings/billing/page.tsx", "utf8");
  const billingActions = readFileSync("app/dashboard/settings/billing/actions.ts", "utf8");
  assert.match(billingPage, /activeMembership\.role !== "owner"/);
  assert.equal((billingActions.match(/activeMembership\.role!=="owner"/g) ?? []).length, 2);
});

test("high-value action responses do not return raw exception or database messages", () => {
  const files = [
    "app/shop/[slug]/actions.ts",
    "app/accept-invite/actions.ts",
    "app/appointment/[token]/actions.ts",
    "app/dashboard/appointments/salon-actions.ts",
    "app/dashboard/bookings/actions.ts",
    "app/dashboard/inventory/actions.ts",
    "app/dashboard/job-actions.ts",
    "app/dashboard/jobs/advisor-actions.ts",
    "app/dashboard/operations-actions.ts",
    "app/api/billing/reconcile/route.ts",
    "app/api/billing/stripe/webhook/route.ts",
  ];
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /encodeURIComponent\(error(?:\?|)\.message\)/);
  assert.doesNotMatch(source, /error instanceof Error\s*\?\s*error\.message/);
  assert.doesNotMatch(source, /NextResponse\.json\(\{\s*error:\s*error\.message/);
});
