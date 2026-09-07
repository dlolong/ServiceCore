import assert from "node:assert/strict";
import test from "node:test";

import { hasFeatureAccess } from "../modules/platform/features";
import { industrySupportsFeature, karkrAutomotiveConfig, resolveIndustryConfig, salonConfig } from "../modules/platform/industry";
import { groupNavigation, karkrNavigation, navigationForIndustry } from "../modules/platform/navigation";
import { isStaffRoleAvailableForIndustry, staffRoleLabelForIndustry, staffRoleOptionsForIndustry } from "../lib/rbac";

test("KarKR enables current automotive capabilities without future engines", () => {
  assert.equal(karkrAutomotiveConfig.productName, "NegOSu Automotive");
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

test("navigation is grouped into compact vertical-appropriate sections", () => {
  const automotiveGroups = groupNavigation(navigationForIndustry(karkrAutomotiveConfig, "owner"));
  const salonGroups = groupNavigation(navigationForIndustry(salonConfig, "owner"));
  assert.equal(salonGroups.find((group) => group.key === "customers")?.label, "Clients");

  assert.deepEqual(automotiveGroups.map(({ key }) => key), ["dashboard", "operations", "customers", "business", "more"]);
  assert.deepEqual(salonGroups.map(({ key }) => key), ["dashboard", "operations", "customers", "business", "more"]);
  assert.ok(automotiveGroups[1].items.some(({ key }) => key === "appointments"));
  assert.ok(automotiveGroups[1].items.some(({ key }) => key === "jobs"));
  assert.ok(salonGroups[1].items.some(({ key }) => key === "appointments"));
  assert.ok(salonGroups[2].items.some(({ key }) => key === "customers"));
  assert.ok(automotiveGroups[3].items.some(({ key }) => key === "staff"));
  assert.ok(automotiveGroups[4].items.some(({ key }) => key === "branches"));
  assert.ok(automotiveGroups[4].items.some(({ key }) => key === "resources"));
  assert.ok(salonGroups[4].items.some(({ key }) => key === "settings"));
});

test("Salon enables shared scheduling and inventory while disabling Automotive operations", () => {
  assert.equal(salonConfig.productName,"NegOSu Salon & Beauty");
  assert.equal(industrySupportsFeature(salonConfig,"appointments"),true);
  assert.equal(industrySupportsFeature(salonConfig,"inventory"),true);
  assert.equal(industrySupportsFeature(salonConfig,"vehicles"),false);
  assert.equal(industrySupportsFeature(salonConfig,"job_orders"),false);
  assert.equal(industrySupportsFeature(salonConfig,"queue"),false);
  assert.equal(industrySupportsFeature(salonConfig,"payments"),false);
});

test("Salon navigation contains only working shared capabilities and terminology", () => {
  const navigation=navigationForIndustry(salonConfig,"owner");
  assert.ok(navigation.some(item=>item.label==="Clients"&&item.href==="/dashboard/customers"));
  assert.ok(navigation.some(item=>item.label==="Treatments"&&item.href==="/dashboard/services"));
  for(const path of ["/dashboard/vehicles","/dashboard/queue","/dashboard/jobs","/dashboard/payments","/dashboard/reminders"]){
    assert.equal(navigation.some(item=>item.href===path),false);
  }
});

test("unsupported industry values fail closed",()=>{
  assert.throws(()=>resolveIndustryConfig("corrupt"),/Unsupported organization industry/);
});

test("staff access roles use the active business terminology", () => {
  const automotiveRoles = staffRoleOptionsForIndustry("automotive");
  const salonRoles = staffRoleOptionsForIndustry("salon");

  assert.equal(staffRoleLabelForIndustry("advisor", "automotive"), "Service Advisor");
  assert.equal(staffRoleLabelForIndustry("technician", "automotive"), "Technician");
  assert.equal(staffRoleLabelForIndustry("advisor", "salon"), "Front Desk / Coordinator");
  assert.equal(staffRoleLabelForIndustry("technician", "salon"), "Service Provider");
  assert.equal(salonRoles.some(({ label }) => /Advisor|Technician/.test(label)), false);
  assert.deepEqual(automotiveRoles.map(({ value }) => value), salonRoles.map(({ value }) => value));
  assert.equal(isStaffRoleAvailableForIndustry("manager", "salon"), true);
  assert.equal(isStaffRoleAvailableForIndustry("manager", "hospitality"), false);
});
