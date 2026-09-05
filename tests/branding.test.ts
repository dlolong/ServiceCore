import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { productBrand, supportedVerticalKeys, verticalBrands } from "../modules/platform/brand";

const read = (path: string) => readFileSync(path, "utf8");

test("NegOSu brand contract preserves approved casing and supported verticals", () => {
  assert.equal(productBrand.name, "NegOSu");
  assert.match(productBrand.tagline, /Operating System/);
  assert.deepEqual(supportedVerticalKeys, ["automotive", "salon"]);
  assert.equal(verticalBrands.automotive.displayName, "NegOSu Automotive");
  assert.equal(verticalBrands.salon.displayName, "NegOSu Salon & Beauty");
});

test("vertical marketing paths retain allowlisted signup context", () => {
  assert.equal(verticalBrands.automotive.signupPath, "/signup?industry=automotive");
  assert.equal(verticalBrands.salon.signupPath, "/signup?industry=salon");
  assert.equal(verticalBrands.automotive.loginPath, "/login?industry=automotive");
  assert.equal(verticalBrands.salon.loginPath, "/login?industry=salon");
});

test("public marketing pages use NegOSu rather than internal legacy brands", () => {
  const sources = [read("app/page.tsx"), read("app/automotive/page.tsx"), read("app/salon/page.tsx"), read("components/marketing/product-landing.tsx")].join("\n");
  assert.doesNotMatch(sources, /ServiceCore|KarKR/);
  assert.doesNotMatch(sources, /Negosu|NEGOSU|NegoSu|NegOSU/);
  assert.match(sources, /NegOSu Automotive/);
  assert.match(sources, /NegOSu Salon & Beauty/);
});

test("Salon marketing copy stays free of Automotive domain vocabulary", () => {
  const source = read("app/salon/page.tsx");
  assert.doesNotMatch(source, /vehicle|job order|inspection|VIN|odometer/i);
  assert.match(source, /Clients/);
  assert.match(source, /Treatments/);
});

test("public pages and shared navigation expose stable NegOSu IDs", () => {
  const sources = [read("app/page.tsx"), read("app/automotive/page.tsx"), read("app/salon/page.tsx"), read("components/marketing/product-landing.tsx")].join("\n");
  for (const id of [
    "negosu-home-page",
    "negosu-main-header",
    "negosu-hero",
    "negosu-start-free-button",
    "negosu-explore-solutions-button",
    "negosu-industry-selector",
    "negosu-automotive-card",
    "negosu-salon-card",
    "negosu-automotive-page",
    "negosu-salon-page",
    "negosu-mobile-menu-button",
    "negosu-main-footer",
  ]) assert.match(sources, new RegExp(id));
});

test("public SEO includes both vertical routes without referencing missing social images", () => {
  const layout = read("app/layout.tsx");
  const homepage = read("app/page.tsx");
  const sitemap = read("app/sitemap.ts");
  const robots = read("app/robots.ts");
  assert.match(layout, /productBrand\.name/);
  assert.match(homepage, /title: \{ absolute: "NegOSu \| Business Operating System" \}/);
  assert.doesNotMatch(layout, /KarKR_logo|images:/);
  assert.match(sitemap, /verticalBrands/);
  assert.match(robots, /\/automotive/);
  assert.match(robots, /\/salon/);
});

test("shared wordmark selects the approved logo for light and dark surfaces", () => {
  const wordmark = read("components/brand-wordmark.tsx");
  assert.match(wordmark, /NegOSu_logo_dark\.png/);
  assert.match(wordmark, /NegOSu_logo_light\.png/);
  assert.match(wordmark, /inverse \?/);
  assert.ok(existsSync("public/images/NegOSu_logo_dark.png"));
  assert.ok(existsSync("public/images/NegOSu_logo_light.png"));
});

test("authenticated customer surfaces and Automotive errors use the NegOSu commercial brand", () => {
  const sources = [
    "app/dashboard/settings/billing/page.tsx",
    "app/dashboard/invoices/[invoiceId]/page.tsx",
    "app/dashboard/jobs/[jobId]/page.tsx",
    "app/dashboard/appointments/[appointmentId]/page.tsx",
    "app/dashboard/customers/[customerId]/preferences/page.tsx",
    "app/dashboard/reminders/page.tsx",
    "app/dashboard/reports/export/route.ts",
    "modules/automotive/appointments.ts",
    "modules/automotive/scheduling/automotive-scheduling.service.ts",
    "components/section-placeholder.tsx",
  ].map(read).join("\n");

  assert.doesNotMatch(sources, /KarKR/);
  assert.match(sources, /productBrand|verticalBrands/);
});

test("customer-facing Automotive compatibility surfaces consume centralized NegOSu branding", () => {
  const sources = [
    read("components/estimate-approval-link-controls.tsx"),
    read("app/accept-invite/page.tsx"),
    read("app/estimate/[token]/page.tsx"),
    read("app/shop/[slug]/page.tsx"),
  ].join("\n");
  assert.doesNotMatch(sources, /KarKR|ServiceCore/);
  assert.match(sources, /@\/modules\/platform\/brand/);
  assert.match(sources, /productBrand|verticalBrands/);
});

test("architecture docs distinguish public NegOSu routes from internal ServiceCore", () => {
  const architecture = read("docs/ARCHITECTURE.md");
  assert.match(architecture, /`\/` presents the master NegOSu experience/);
  assert.match(architecture, /`\/automotive` presents NegOSu Automotive/);
  assert.match(architecture, /`\/salon` presents NegOSu Salon & Beauty/);
  assert.match(architecture, /ServiceCore remains the internal shared-platform/);
});
