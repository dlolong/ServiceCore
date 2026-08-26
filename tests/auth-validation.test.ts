import assert from "node:assert/strict";
import test from "node:test";

import { branchOnboardingSchema, businessOnboardingSchema, organizationIdSchema, profileSchema, signUpSchema, slugifyOrganizationName, updatePasswordSchema } from "../lib/auth/schemas";
import { selectOnboardingDestination } from "../lib/auth/onboarding-state";
import { safeRedirectPath } from "../lib/auth/redirect";

test("onboarding accepts only a normalized shop identity", () => {
  const result = businessOnboardingSchema.parse({ businessName: "  AutoShine  ", businessType: "auto_detailing", slug: "auto-shine", phone: "" });
  assert.equal(result.businessName, "AutoShine");
  assert.equal(result.slug, "auto-shine");
  assert.equal(businessOnboardingSchema.safeParse({ businessName: "Shop", businessType: "other", slug: "../other-org" }).success, false);
  assert.equal(businessOnboardingSchema.safeParse({ businessName: "Shop", businessType: "other", slug: "Other Org" }).success, false);
  assert.equal(slugifyOrganizationName("Mar's Premium Auto Detailing"), "mars-premium-auto-detailing");
});

test("organization selection accepts UUIDs, never roles or arbitrary identifiers", () => {
  assert.equal(organizationIdSchema.safeParse("00000000-0000-4000-8000-000000000001").success, true);
  assert.equal(organizationIdSchema.safeParse("owner").success, false);
  assert.equal(organizationIdSchema.safeParse("other-tenant").success, false);
});

test("authentication and profile writes enforce boundary validation", () => {
  assert.equal(signUpSchema.safeParse({ firstName: "A", lastName: "B", email: "bad", password: "short", confirmPassword: "different" }).success, false);
  const signup = signUpSchema.parse({ firstName: "Maria", lastName: "Dela Cruz", email: " MARIA@example.com ", password: "correct-horse", confirmPassword: "correct-horse" });
  assert.equal(signup.email, "maria@example.com");
  assert.equal(updatePasswordSchema.safeParse({ password: "correct-horse", confirmPassword: "different" }).success, false);
  assert.equal(profileSchema.safeParse({ fullName: "Maria Dela Cruz", phone: "x".repeat(31) }).success, false);
});

test("branch onboarding requires valid Philippine address basics", () => {
  assert.equal(branchOnboardingSchema.safeParse({ organizationId: "not-an-org", branchName: "Main", addressLine: "1 Street", city: "Pasig", province: "Metro Manila", country: "Philippines" }).success, false);
  assert.equal(branchOnboardingSchema.safeParse({ organizationId: "00000000-0000-4000-8000-000000000001", branchName: "Main Branch", addressLine: "1 Street", city: "Pasig", province: "Metro Manila", country: "Philippines" }).success, true);
});

test("onboarding state is derived from memberships and active branches", () => {
  assert.deepEqual(selectOnboardingDestination([]), { path: "/onboarding/business", organizationId: null });
  assert.deepEqual(selectOnboardingDestination([{ organizationId: "org-a", hasActiveBranch: false }]), { path: "/onboarding/branch", organizationId: "org-a" });
  assert.deepEqual(selectOnboardingDestination([{ organizationId: "org-a", hasActiveBranch: true }]), { path: "/dashboard", organizationId: "org-a" });
});

test("auth redirects remain local", () => {
  assert.equal(safeRedirectPath("/dashboard/settings", "/dashboard"), "/dashboard/settings");
  assert.equal(safeRedirectPath("//evil.example", "/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("https://evil.example", "/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("/\\evil.example", "/dashboard"), "/dashboard");
  assert.equal(safeRedirectPath("/auth/callback?code=attacker", "/dashboard"), "/dashboard");
});
