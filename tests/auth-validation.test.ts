import assert from "node:assert/strict";
import test from "node:test";

import { onboardingSchema, organizationIdSchema, profileSchema, signUpSchema } from "../lib/auth/schemas";
import { safeRedirectPath } from "../lib/auth/redirect";

test("onboarding accepts only a normalized shop identity", () => {
  const result = onboardingSchema.parse({ businessName: "  AutoShine  ", slug: "auto-shine", phone: "" });
  assert.equal(result.businessName, "AutoShine");
  assert.equal(result.slug, "auto-shine");
  assert.equal(onboardingSchema.safeParse({ businessName: "Shop", slug: "../other-org" }).success, false);
  assert.equal(onboardingSchema.safeParse({ businessName: "Shop", slug: "Other Org" }).success, false);
});

test("organization selection accepts UUIDs, never roles or arbitrary identifiers", () => {
  assert.equal(organizationIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success, true);
  assert.equal(organizationIdSchema.safeParse("owner").success, false);
  assert.equal(organizationIdSchema.safeParse("other-tenant").success, false);
});

test("authentication and profile writes enforce boundary validation", () => {
  assert.equal(signUpSchema.safeParse({ fullName: "A", email: "bad", password: "short" }).success, false);
  assert.equal(signUpSchema.safeParse({ fullName: "Maria Dela Cruz", email: "maria@example.com", password: "correct-horse" }).success, true);
  assert.equal(profileSchema.safeParse({ fullName: "Maria Dela Cruz", phone: "x".repeat(31) }).success, false);
});

test("auth redirects remain local", () => {
  assert.equal(safeRedirectPath("/dashboard/settings", "/dashboard"), "/dashboard/settings");
  assert.equal(safeRedirectPath("//evil.example", "/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("https://evil.example", "/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("/\\evil.example", "/dashboard"), "/dashboard");
});
