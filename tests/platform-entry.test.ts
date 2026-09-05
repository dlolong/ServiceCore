import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateOnboardingProgress, onboardingForIndustry } from "../modules/platform/onboarding";
import { createFirstOrganizationWithCompatibility } from "../lib/auth/organization-onboarding";
import { isPublicProductKey, resolveBusinessIndustry, resolveOptionalProductEntry, resolveProductEntry } from "../modules/platform/product-entry";

test("public product entry uses NegOSu vertical names while compatibility resolution remains Automotive", () => {
  assert.equal(resolveProductEntry("automotive").productName, "NegOSu Automotive");
  assert.equal(resolveProductEntry("salon").productName, "NegOSu Salon & Beauty");
  assert.equal(resolveProductEntry("hospitality").industry, "automotive");
  assert.equal(resolveOptionalProductEntry("hospitality"), null);
  assert.equal(resolveOptionalProductEntry(undefined), null);
  assert.equal(isPublicProductKey("field_service"), false);
});

test("business types have one explicit industry mapping", () => {
  assert.equal(resolveBusinessIndustry("auto_repair"), "automotive");
  assert.equal(resolveBusinessIndustry("spa"), "salon");
  assert.equal(resolveBusinessIndustry("invented"), null);
});

test("vertical onboarding uses config-driven terminology and derived progress", () => {
  const salon = onboardingForIndustry("salon");
  const automotive = onboardingForIndustry("automotive");
  assert.equal(automotive.title, "Welcome to NegOSu Automotive");
  assert.equal(salon.title, "Welcome to NegOSu Salon & Beauty");
  assert.ok(salon.steps.some(({ label }) => label === "Add Treatments"));
  assert.ok(salon.steps.every(({ key }) => key !== "vehicles"));
  assert.ok(automotive.steps.some(({ label }) => label === "Add Vehicle"));
  assert.deepEqual(calculateOnboardingProgress(salon, {
    branch: true,
    services: true,
    staff: false,
    resources: false,
    customers: false,
    vehicles: false,
    appointments: false,
  }), { completed: 2, total: 6, percentage: 33 });
});

test("first-organization migration keeps server-owned role and concurrency lock", () => {
  const migration = readFileSync("supabase/migrations/0050_vertical_product_entry.sql", "utf8");
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(current_user_id::text/);
  assert.match(migration, /values \(new_organization_id, current_user_id, 'owner'\)/);
  assert.match(migration, /normalized_industry not in \('automotive', 'salon'\)/);
  assert.match(migration, /Business type does not match organization industry/);
});

test("vertical pages and auth forms expose stable operational IDs", () => {
  const sources = [
    readFileSync("app/page.tsx", "utf8"),
    readFileSync("app/automotive/page.tsx", "utf8"),
    readFileSync("app/salon/page.tsx", "utf8"),
    readFileSync("app/login/page.tsx", "utf8"),
    readFileSync("app/signup/page.tsx", "utf8"),
    readFileSync("components/business-type-selector.tsx", "utf8"),
    readFileSync("app/organizations/page.tsx", "utf8"),
    readFileSync("app/onboarding/setup/page.tsx", "utf8"),
  ].join("\n");
  for (const id of ["negosu-home-page", "negosu-automotive-page", "negosu-salon-page", "negosu-login-page", "negosu-signup-page", "negosu-business-selector", "negosu-onboarding-progress"]) assert.match(sources, new RegExp(id));
  assert.match(sources, /idPrefix="negosu"/);
  assert.match(sources, /business-type-selector/);
});

test("generic signup requires a meaningful business choice while vertical links only prefill it", () => {
  const signup = readFileSync("app/signup/page.tsx", "utf8");
  const selector = readFileSync("components/business-type-selector.tsx", "utf8");
  assert.match(signup, /resolveOptionalProductEntry\(params\.industry\)/);
  assert.match(signup, /initialIndustry=\{entry\?\.industry\}/);
  assert.doesNotMatch(selector, /initialIndustry\s*=\s*"automotive"/);
  assert.match(selector, /name="industry"/);
  assert.match(selector, /required/);
});

test("organization activation reauthorizes membership and clears stale branch context", () => {
  const source = readFileSync("lib/auth/active-organization.ts", "utf8");
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /\.eq\("is_active", true\)/);
  assert.match(source, /cookieStore\.set\(ACTIVE_ORGANIZATION_COOKIE/);
  assert.match(source, /cookieStore\.delete\(ACTIVE_BRANCH_COOKIE\)/);
});

test("KarKR onboarding falls back to the legacy Automotive RPC during a rolling deployment", async () => {
  const calls: Array<Record<string, string | null>> = [];
  const result = await createFirstOrganizationWithCompatibility(async (parameters) => {
    calls.push(parameters);
    if (calls.length === 1) return { data: null, error: { code: "PGRST202" } };
    return { data: "00000000-0000-4000-8000-000000000001", error: null };
  }, {
    industry: "automotive",
    businessName: "KarKR Test",
    businessType: "auto_repair",
    slug: "karkr-test",
  });

  assert.equal(result.organizationId, "00000000-0000-4000-8000-000000000001");
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.p_industry, "automotive");
  assert.equal("p_industry" in (calls[1] ?? {}), false);
});

test("Salon onboarding never falls back to an Automotive-only legacy RPC", async () => {
  let callCount = 0;
  const result = await createFirstOrganizationWithCompatibility(async () => {
    callCount += 1;
    return { data: null, error: { code: "PGRST202" } };
  }, {
    industry: "salon",
    businessName: "Salon Test",
    businessType: "salon",
    slug: "salon-test",
  });

  assert.deepEqual(result, { organizationId: null, errorCode: "ONBOARDING_SCHEMA_OUTDATED" });
  assert.equal(callCount, 1);
});
