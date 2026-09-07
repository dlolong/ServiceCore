import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("owner reports use click-first sections without a mobile table overflow trap", () => {
  const reports = source("app/dashboard/reports/page.tsx");

  for (const id of [
    "reports-page",
    "reports-filter-form",
    "reports-summary",
    "reports-section-tabs",
    "reports-tab-overview",
    "reports-tab-revenue",
    "reports-tab-team",
    "reports-tab-branches",
  ]) {
    assert.match(reports, new RegExp(id));
  }

  assert.match(reports, /section === "overview"/);
  assert.match(reports, /section === "revenue"/);
  assert.match(reports, /section === "team"/);
  assert.match(reports, /section === "branches"/);
  assert.match(reports, /reports-daily-mobile-list/);
  assert.doesNotMatch(reports, /min-w-\[520px\]|overflow-x-auto/);
  assert.doesNotMatch(reports, /font-black|font-extrabold/);
});

test("booking request actions remain clear and reachable on narrow screens", () => {
  const bookings = source("app/dashboard/bookings/page.tsx");

  for (const id of [
    "booking-requests-page",
    "booking-requests-page-header",
    "booking-requests-error",
    "booking-requests-retry-button",
    "booking-requests-list",
    "booking-requests-empty-state",
    "booking-request-confirm-form-",
    "booking-request-decline-form-",
    "booking-request-decline-reason-",
  ]) {
    assert.match(bookings, new RegExp(id));
  }

  assert.match(bookings, /Could not load booking requests/);
  assert.match(bookings, /Decline reason/);
  assert.match(bookings, /w-full sm:w-auto/);
  assert.doesNotMatch(bookings, /font-black|font-extrabold/);
});

test("billing keeps plan decisions visible and moves secondary details behind disclosure", () => {
  const billing = source("app/dashboard/settings/billing/page.tsx");

  for (const id of [
    "billing-page",
    "billing-page-header",
    "billing-current-plan",
    "billing-plans",
    "billing-plan-details-",
    "billing-checkout-form-",
    "billing-interval-",
    "billing-choose-plan-",
  ]) {
    assert.match(billing, new RegExp(id));
  }

  assert.match(billing, /<details/);
  assert.match(billing, /View plan details/);
  assert.match(billing, /sm:grid-cols-2 xl:grid-cols-3/);
  assert.match(billing, /Could not load billing/);
  assert.doesNotMatch(billing, /font-black|font-extrabold/);
  assert.match(billing, /productBrand\.name/);
});

test("primary Automotive and Salon operational surfaces avoid extra-heavy typography", () => {
  const operationalSources = [
    "components/command-center/command-center.tsx",
    "app/dashboard/appointments/page.tsx",
    "app/dashboard/queue/page.tsx",
    "app/dashboard/jobs/page.tsx",
    "app/dashboard/customers/page.tsx",
    "app/dashboard/vehicles/page.tsx",
    "app/dashboard/services/page.tsx",
    "app/dashboard/settings/staff/page.tsx",
    "app/dashboard/inventory/page.tsx",
    "app/dashboard/payments/page.tsx",
    "app/dashboard/reminders/page.tsx",
    "app/dashboard/settings/page.tsx",
  ].map(source).join("\n");

  assert.doesNotMatch(operationalSources, /font-black|font-extrabold/);
});
