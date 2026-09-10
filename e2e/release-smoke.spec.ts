import { expect, test } from "@playwright/test";

import { assertOperationalRoute, authenticatedSmokeEnabled, loginAsOwner } from "./helpers/auth";

test.describe("public release smoke", () => {
  const publicRoutes = [
    ["/", "negosu-home-page"],
    ["/automotive", "negosu-automotive-page"],
    ["/salon", "negosu-salon-page"],
    ["/plans", "negosu-plans-page"],
    ["/login", "negosu-login-page"],
    ["/signup", "negosu-signup-page"],
    ["/forgot-password", "negosu-forgot-password-page"],
  ] as const;

  for (const [route, rootId] of publicRoutes) {
    test(`${route} is available`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator(`#${rootId}`)).toBeVisible();
    });
  }

  test("health endpoint is safe and available", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBe(true);
    const payload = await response.json();
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("servicecore-web");
    expect(payload).not.toHaveProperty("environment");
    expect(payload).not.toHaveProperty("database");
  });
});

test.describe("Automotive owner smoke", () => {
  test.skip(!authenticatedSmokeEnabled(), "Run after the guarded QA persona seed with E2E_AUTHENTICATED=1.");

  test("critical Automotive routes load", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsOwner(page, "automotive");
    for (const [route, rootId] of [
      ["/dashboard", "negosu-command-center-page"],
      ["/dashboard/appointments", "appointments-page"],
      ["/dashboard/customers", "customers-page"],
      ["/dashboard/vehicles", "vehicles-page"],
      ["/dashboard/jobs", "job-orders-page"],
      ["/dashboard/inventory", "inventory-page"],
      ["/dashboard/payments", "payments-page"],
      ["/dashboard/settings/staff", "staff-page"],
      ["/dashboard/settings/billing", "billing-page"],
    ] as const) await assertOperationalRoute(page, route, rootId);
  });
});

test.describe("Salon owner smoke", () => {
  test.skip(!authenticatedSmokeEnabled(), "Run after the guarded QA persona seed with E2E_AUTHENTICATED=1.");

  test("critical Salon routes load", async ({ page }) => {
    test.setTimeout(180_000);
    await loginAsOwner(page, "salon");
    for (const [route, rootId] of [
      ["/dashboard", "negosu-command-center-page"],
      ["/dashboard/appointments", "salon-appointments-page"],
      ["/dashboard/customers", "salon-clients-page"],
      ["/dashboard/services", "salon-treatments-page"],
      ["/dashboard/settings/staff", "salon-staff-page"],
      ["/dashboard/inventory", "salon-inventory-page"],
      ["/dashboard/settings/billing", "billing-page"],
    ] as const) await assertOperationalRoute(page, route, rootId);
  });
});
