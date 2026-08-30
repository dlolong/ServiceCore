import assert from "node:assert/strict";
import test from "node:test";

import { hasFeatureAccess } from "../modules/platform/features";
import { industrySupportsFeature, karkrAutomotiveConfig } from "../modules/platform/industry";
import { karkrNavigation } from "../modules/platform/navigation";

test("KarKR enables current automotive capabilities without future engines", () => {
  assert.equal(industrySupportsFeature(karkrAutomotiveConfig, "vehicles"), true);
  assert.equal(industrySupportsFeature(karkrAutomotiveConfig, "job_orders"), true);
  assert.equal(industrySupportsFeature(karkrAutomotiveConfig, "reservations"), false);
  assert.equal(industrySupportsFeature(karkrAutomotiveConfig, "commissions"), false);
});

test("feature access keeps capability, entitlement, and permission independent", () => {
  const context = {
    supportedIndustryFeatures: new Set(["vehicles"] as const),
    subscriptionEntitlements: new Set(["reminders"] as const),
    permissions: new Set(["vehicles.read"] as const),
  };

  assert.equal(hasFeatureAccess({ industryFeature: "vehicles", permission: "vehicles.read" }, context), true);
  assert.equal(hasFeatureAccess({ industryFeature: "job_orders" }, context), false);
  assert.equal(hasFeatureAccess({ subscriptionFeature: "advanced_reports" }, context), false);
  assert.equal(hasFeatureAccess({ permission: "vehicles.write" }, context), false);
});

test("navigation keys and destinations are stable and unique", () => {
  assert.equal(new Set(karkrNavigation.map(({ key }) => key)).size, karkrNavigation.length);
  assert.equal(new Set(karkrNavigation.map(({ href }) => href)).size, karkrNavigation.length);
});
