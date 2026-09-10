import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findLaunchPlan, launchPlanCatalog, planMatchesLaunchCatalog, visiblePlanFeatureLabels } from "../modules/platform/plan-catalog";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public and authenticated pricing share one complete launch catalog", () => {
  assert.deepEqual(launchPlanCatalog.map(({ id }) => id), ["free", "starter", "business", "pro", "multi_branch"]);
  assert.equal(findLaunchPlan("business")?.recommended, true);
  assert.equal(findLaunchPlan("starter")?.monthlyPriceCentavos, 49_900);
  assert.equal(findLaunchPlan("business")?.yearlyPriceCentavos, 999_000);
  assert.equal(findLaunchPlan("multi_branch")?.custom, true);

  for (const plan of launchPlanCatalog) {
    assert.equal(planMatchesLaunchCatalog({
      id: plan.id,
      name: plan.name,
      monthly_price_centavos: plan.monthlyPriceCentavos,
      yearly_price_centavos: plan.yearlyPriceCentavos,
      is_custom: plan.custom,
    }), true);
  }

  assert.equal(planMatchesLaunchCatalog({
    id: "starter",
    name: "Starter",
    monthly_price_centavos: 50_000,
    yearly_price_centavos: 499_000,
    is_custom: false,
  }), false);
});

test("launch catalog remains synchronized with the seeded database plan prices", () => {
  const initialBilling = source("supabase/migrations/0002_billing.sql");
  const customPlan = source("supabase/migrations/0028_phase11_revenue_phase12_billing.sql");

  assert.match(initialBilling, /\('free','Free',0,0/);
  assert.match(initialBilling, /\('starter','Starter',49900,499000/);
  assert.match(initialBilling, /\('business','Business',99900,999000/);
  assert.match(initialBilling, /\('pro','Pro',199900,1999000/);
  assert.match(customPlan, /\('multi_branch','Multi-Branch',0,null/);
});

test("Plans is discoverable, responsive, and uses clear launch actions", () => {
  const plansPage = source("app/plans/page.tsx");
  const planCatalog = source("components/marketing/plan-catalog.tsx");
  const marketingNavigation = source("components/marketing/product-landing.tsx");
  const homepage = source("app/page.tsx");
  const sitemap = source("app/sitemap.ts");

  for (const id of ["negosu-plans-page", "negosu-plans-header", "negosu-plans-catalog", "negosu-plan-grid", "negosu-plan-note"]) {
    assert.match(`${plansPage}\n${planCatalog}`, new RegExp(id));
  }
  assert.match(homepage, /<PublicPlanCatalog compact/);
  assert.match(marketingNavigation, /negosu-desktop-plans-link/);
  assert.match(marketingNavigation, /negosu-mobile-plans-link/);
  assert.match(marketingNavigation, /negosu-footer-plans-link/);
  assert.match(planCatalog, /sm:grid-cols-2 xl:grid-cols-5/);
  assert.match(planCatalog, /Start free/);
  assert.match(planCatalog, /Contact sales/);
  assert.match(planCatalog, /Available tools vary by industry and plan/);
  assert.match(sitemap, /\/plans/);
  assert.doesNotMatch(planCatalog, /appointments or jobs per month/i);
  assert.doesNotMatch(planCatalog, /Every plan supports/i);
  const publicClaims = launchPlanCatalog.flatMap((plan) => [plan.summary, ...plan.highlights]).join("\n");
  assert.doesNotMatch(publicClaims, /Public business page|Reminders and advanced reports|All Business features/);
});

test("Billing blocks catalog drift and keeps Automotive-only limits out of Salon copy", () => {
  const billing = source("app/dashboard/settings/billing/page.tsx");
  assert.match(billing, /planMatchesLaunchCatalog/);
  assert.match(billing, /hasCatalogMismatch/);
  assert.match(billing, /industry === "automotive"/);
  assert.match(billing, /Job Orders\/month/);
  assert.match(billing, /contact support/);
  assert.doesNotMatch(billing, /feature\.replaceAll/);

  const enabledFeatures = { public_page: true, reminders: true, advanced_reports: true, ai: true };
  assert.deepEqual(visiblePlanFeatureLabels("salon", enabledFeatures), ["Public business page", "Appointment reminders"]);
  assert.deepEqual(visiblePlanFeatureLabels("automotive", enabledFeatures), ["Public business page", "Maintenance reminders", "Advanced Automotive reports"]);
  assert.deepEqual(visiblePlanFeatureLabels("hospitality", enabledFeatures), []);
});

test("onboarding recommends one next step and always allows dashboard entry", () => {
  const onboarding = source("app/onboarding/setup/page.tsx");
  assert.match(onboarding, /config\.steps\.find/);
  assert.match(onboarding, /negosu-onboarding-next-step/);
  assert.match(onboarding, /Recommended next step/);
  assert.match(onboarding, /Skip for now and open dashboard/);
  assert.match(onboarding, /negosu-onboarding-complete/);
});

test("direct dashboard database failures use controlled customer messages", () => {
  const sources = [
    "app/dashboard/bookings/actions.ts",
    "app/dashboard/settings/resources/actions.ts",
    "app/dashboard/inventory/actions.ts",
    "app/dashboard/reminders/actions.ts",
  ].map(source).join("\n");

  assert.doesNotMatch(sources, /encodeURIComponent\(error\.message\)/);
  assert.doesNotMatch(sources, /go\([^\n]*error\.message/);
  assert.doesNotMatch(sources, /result\.error\.message/);
  assert.match(sources, /Refresh\+and\+try\+again|Refresh and try again/);
});
