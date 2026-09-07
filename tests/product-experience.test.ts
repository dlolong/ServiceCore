import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public product entry keeps the approved message and restrained shared visual treatment", () => {
  const home = source("app/page.tsx");
  const automotive = source("app/automotive/page.tsx");
  const salon = source("app/salon/page.tsx");
  const marketing = source("components/marketing/product-landing.tsx");
  assert.match(home, /productBrand\.tagline/);
  assert.match(home, /negosu-start-free-button/);
  assert.match(home, /negosu-explore-solutions-button/);
  assert.doesNotMatch(`${home}\n${automotive}\n${salon}\n${marketing}`, /shadow-2xl|bg-cyan|text-cyan/);
  assert.match(home, /shadow-ui-md/);
  assert.match(automotive, /negosu-automotive-page/);
  assert.match(salon, /negosu-salon-page/);
  for (const id of [
    "negosu-desktop-solutions-link",
    "negosu-mobile-solutions-link",
    "negosu-footer-automotive-link",
    "negosu-footer-salon-link",
  ]) assert.match(marketing, new RegExp(id));
});

test("auth and onboarding use one document scroll with the shared elevation contract", () => {
  const files = [
    "components/auth-shell.tsx",
    "app/onboarding/business/page.tsx",
    "app/onboarding/branch/page.tsx",
    "app/onboarding/setup/page.tsx",
  ].map(source).join("\n");
  assert.doesNotMatch(files, /overflow-y-auto/);
  assert.doesNotMatch(files, /shadow-\[/);
  assert.match(files, /shadow-ui-md/);
  for (const id of ["negosu-onboarding-business-page", "negosu-onboarding-branch-page", "negosu-onboarding-progress"]) assert.match(files, new RegExp(id));
});

test("Command Center keeps compact hierarchy and names non-color status meaning", () => {
  const commandCenter = source("components/command-center/command-center.tsx");
  const loading = source("app/dashboard/loading.tsx");
  assert.match(commandCenter, /border-l-4 border-l-brand-primary/);
  assert.match(commandCenter, /\{action\.priority\}/);
  assert.match(commandCenter, /\{staff\.status\}/);
  assert.match(commandCenter, /elevation="none"/);
  assert.doesNotMatch(commandCenter, /className="[^"]*shadow-none/);
  for (const id of ["negosu-command-center-header", "negosu-command-center-metrics", "negosu-action-inbox", "negosu-today-operations"]) assert.match(loading, new RegExp(id));
});

test("high-traffic schedules and catalog avoid tablet-width overflow traps", () => {
  const appointments = source("app/dashboard/appointments/page.tsx");
  const services = source("app/dashboard/services/page.tsx");
  assert.match(appointments, /sm:grid-cols-2 xl:grid-cols-/);
  assert.match(appointments, />Search<input/);
  assert.match(appointments, />Range<select/);
  assert.match(appointments, />Status<select/);
  assert.match(services, /xl:grid-cols-\[240px_minmax\(0,1fr\)\]/);
  assert.match(services, /shadow-ui-sm xl:block/);
  assert.match(services, /salon-treatments-mobile-list[^\n]*xl:hidden/);
  assert.doesNotMatch(services, /grid-cols-\[1fr_70px_auto\]/);
  assert.match(services, /salon\?"salon-treatment":"service"/);
  assert.match(services, /-card-\$\{service\.id\}/);
  assert.match(services, /services-empty-state/);
});

test("inventory and CRM forms expose visible labels and stable operational IDs", () => {
  const inventory = source("app/dashboard/inventory/page.tsx");
  const crm = source("components/crm-forms.tsx");
  for (const label of ["Product name", "Cost (PHP)", "Sell price (PHP)", "Reorder level", "Quantity used"]) assert.match(inventory, new RegExp(`label=\\"${label.replace(/[()]/g, "\\$&")}\\"`));
  assert.match(inventory, /const productPrefix=salon\?"salon-product":"inventory-item",inventoryPrefix=salon\?"salon-inventory":"inventory"/);
  for (const idTemplate of [
    "`${productPrefix}-create-form`",
    "`${inventoryPrefix}-transfer-form`",
  ]) assert.ok(inventory.includes(idTemplate), `Missing deterministic inventory ID template: ${idTemplate}`);
  for (const id of ["inventory-recipe-form", "inventory-recipe-quantity-input"]) assert.match(inventory, new RegExp(id));
  for (const id of ["customer-accept-duplicate-checkbox", "vehicle-accept-duplicate-checkbox", "vehicle-year-input", "vehicle-type-select", "vehicle-odometer-input", "vehicle-vin-input", "branch-save-button"]) assert.match(crm, new RegExp(id));
});

test("public booking and neutral fallback surfaces expose semantic roots and brand copy", () => {
  const shop = source("app/shop/[slug]/page.tsx");
  const booking = source("app/shop/[slug]/book/page.tsx");
  const status = source("app/booking/[token]/page.tsx");
  const notFound = source("app/not-found.tsx");
  for (const id of ["public-automotive-shop-page", "public-automotive-shop-book-button"]) assert.match(shop, new RegExp(id));
  for (const id of ["public-booking-page", "public-booking-availability-form", "public-booking-request-form", "public-booking-submit-button"]) assert.match(booking, new RegExp(id));
  assert.match(status, /public-booking-status-page/);
  assert.match(notFound, /negosu-not-found-page/);
  assert.doesNotMatch(notFound, /garage|amber/i);
  assert.doesNotMatch(`${shop}\n${booking}\n${status}`, /text-amber|bg-amber/);
  assert.match(shop, /from "next\/image"/);
});

test("commercial contact and customer import surfaces use the NegOSu product name", () => {
  const billing = source("app/dashboard/settings/billing/page.tsx");
  const customerTemplate = source("app/dashboard/customers/import/template/route.ts");
  assert.match(billing, /sales@negosu\.com/);
  assert.match(customerTemplate, /negosu-customers-template\.csv/);
  assert.doesNotMatch(`${billing}\n${customerTemplate}`, /servicecore\.com|karkr-customers-template/i);
});

test("public page settings use labelled controls and deterministic management IDs", () => {
  const publicPageSettings = source("app/dashboard/settings/public-page/page.tsx");
  for (const id of [
    "public-page-settings-page",
    "public-page-profile-form",
    "public-page-enabled-checkbox",
    "public-page-save-button",
    "public-services-list",
    "public-gallery-form",
    "public-gallery-add-button",
  ]) assert.match(publicPageSettings, new RegExp(id));
  for (const label of ["Business description", "Logo image URL", "Opening-hours JSON", "Image description"]) {
    assert.match(publicPageSettings, new RegExp(label));
  }
  assert.match(publicPageSettings, /Only services marked Visible publicly appear in the Request Booking dropdown/);
  assert.match(publicPageSettings, /public-services-empty-state/);
});

test("public booking handles an empty published-service catalog without rendering a broken request form", () => {
  const booking = source("app/shop/[slug]/book/page.tsx");
  assert.match(booking, /const hasPublicServices = shop\.services\.length > 0/);
  assert.match(booking, /public-booking-no-services/);
  assert.match(booking, /No services are currently published for online booking/);
  assert.match(booking, /public-booking-request-unavailable/);
  assert.match(booking, /!hasPublicServices \?/);
});
