import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildPublicBookingCalendar, selectPublicBookingDate } from "../lib/public-booking-calendar";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public booking calendar is bounded to the branch-local sixty-day window", () => {
  const calendar = buildPublicBookingCalendar("2026-09", "2026-09-14", "2026-11-13");
  assert.equal(calendar.month, "2026-09");
  assert.equal(calendar.label, "September 2026");
  assert.equal(calendar.queryStart, "2026-09-14");
  assert.equal(calendar.queryEnd, "2026-09-30");
  assert.equal(calendar.previousMonth, null);
  assert.equal(calendar.nextMonth, "2026-10");
  assert.equal(calendar.days.length, 35);
  assert.equal(calendar.days.find(day => day.date === "2026-09-13")?.inBookingWindow, false);
  assert.equal(calendar.days.find(day => day.date === "2026-09-14")?.inBookingWindow, true);
});

test("calendar rejects invalid months and selects only server-advertised dates", () => {
  assert.equal(buildPublicBookingCalendar("2099-99", "2026-09-14", "2026-11-13").month, "2026-09");
  assert.equal(buildPublicBookingCalendar("2026-11", "2026-09-14", "2026-11-13").queryEnd, "2026-11-13");
  assert.equal(selectPublicBookingDate("2026-09-18", ["2026-09-18", "2026-09-19"]), "2026-09-18");
  assert.equal(selectPublicBookingDate("2026-09-17", ["2026-09-18", "2026-09-19"]), "2026-09-18");
  assert.equal(selectPublicBookingDate("not-a-date", []), null);
});

test("booking presents actual availability dates before customer details", () => {
  const page = source("app/shop/[slug]/book/page.tsx");
  const form = source("app/shop/[slug]/book/booking-form.tsx");
  const calendarIndex = page.indexOf('id="public-booking-calendar-section"');
  const detailsIndex = page.indexOf('id="public-booking-details-section"');
  assert.ok(calendarIndex > 0 && detailsIndex > calendarIndex);
  assert.match(page, /get_public_availability_dates_for_services/);
  assert.match(page, /get_public_availability_for_services/);
  assert.match(page, /type="checkbox" name="services"/);
  assert.match(page, /services=\{selectedServices\}/);
  assert.match(page, /public-booking-previous-month/);
  assert.match(page, /public-booking-next-month/);
  assert.doesNotMatch(page, /type="date"/);
  assert.match(form, /type="radio" name="preferredAt"/);
  assert.match(form, /services\.map\(service => <input key=\{service\.id\} type="hidden" name="serviceIds"/);
  assert.match(form, /state\.values\?\./);
  assert.match(form, /public-booking-customer-section/);
  assert.match(form, /public-booking-vehicle-section/);
});

test("multi-service availability remains bounded and uses authoritative combined duration", () => {
  const migration = source("supabase/migrations/0067_multi_service_public_booking_status.sql");
  assert.match(migration, /public_booking_service_duration\(org_id,p_branch_id,p_service_ids\)/);
  assert.match(migration, /public_booking_slot_is_available\(org_id,p_branch_id,candidate,duration\)/);
  assert.match(migration, /p_end_date > p_start_date \+ 41/);
  assert.match(migration, /grant execute[^;]+get_public_availability_for_services[^;]+to anon,authenticated/);
  assert.doesNotMatch(migration, /customer_name|phone|email/);
});

test("private booking status page shows lifecycle progress and refreshes safely", () => {
  const page = source("app/booking/[token]/page.tsx");
  const refresh = source("app/booking/[token]/booking-status-refresh.tsx");
  for (const id of ["public-booking-status-badge", "public-booking-status-services", "public-booking-status-progress", "public-booking-status-refresh"]) {
    assert.match(`${page}\n${refresh}`, new RegExp(id));
  }
  assert.match(page, /scheduledAt \?\? status\.preferredAt/);
  assert.match(refresh, /15_000/);
  assert.match(refresh, /document\.visibilityState === "visible"/);
});

test("availability calendar RPC is bounded and delegates slot authority", () => {
  const migration = source("supabase/migrations/0066_public_booking_availability_calendar.sql");
  assert.match(migration, /p_end_date > p_start_date \+ 41/);
  assert.match(migration, /cross join lateral public\.get_public_availability/);
  assert.match(migration, /grant execute[^;]+to anon,authenticated/);
  assert.doesNotMatch(migration, /from public\.appointments/);
});

test("public shop exposes a complete responsive customer journey", () => {
  const shop = source("app/shop/[slug]/page.tsx");
  for (const id of ["public-shop-header", "public-shop-hero-media", "public-shop-quick-details", "public-shop-services-title", "public-shop-locations-title", "public-shop-social-links"]) {
    assert.match(shop, new RegExp(id));
  }
  assert.match(shop, /View available dates/);
  assert.match(shop, /Book this \{serviceLabel\}/);
  assert.doesNotMatch(shop, /font-black|sm:text-6xl/);
});
