import { expect, type Page } from "@playwright/test";

export type QaPersonaKind = "automotive" | "salon";

const LOCAL_CREDENTIALS = {
  automotive: "qa.automotive.owner@negosu.local.test",
  salon: "qa.salon.owner@negosu.local.test",
  password: "NegOSu-Local-QA-2026!",
};

function isLocalBaseUrl() {
  const url = new URL(process.env.E2E_BASE_URL || "http://127.0.0.1:3100");
  return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
}

export function authenticatedSmokeEnabled() {
  return process.env.E2E_AUTHENTICATED === "1" || process.env.E2E_AUTHENTICATED === "true";
}

export function qaPersonaCredentials(kind: QaPersonaKind) {
  const emailVariable = kind === "automotive" ? "QA_AUTOMOTIVE_OWNER_EMAIL" : "QA_SALON_OWNER_EMAIL";
  const email = process.env[emailVariable] || (isLocalBaseUrl() ? LOCAL_CREDENTIALS[kind] : undefined);
  const password = process.env.QA_OWNER_PASSWORD || (isLocalBaseUrl() ? LOCAL_CREDENTIALS.password : undefined);

  if (!email || !password) {
    throw new Error(`${emailVariable} and QA_OWNER_PASSWORD are required for authenticated smoke against a remote environment.`);
  }
  return { email, password };
}

export async function loginAsOwner(page: Page, kind: QaPersonaKind) {
  const credentials = qaPersonaCredentials(kind);
  await page.goto(`/login?industry=${kind}`);
  await page.locator("#negosu-login-email-input").fill(credentials.email);
  await page.locator("#negosu-login-password-input").fill(credentials.password);
  await page.locator("#negosu-login-submit-button").click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/, { timeout: 20_000 });
  await expect(page.locator("#dashboard-app-shell")).toBeVisible();
}

export async function assertOperationalRoute(page: Page, route: string, expectedRootId: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45_000 });
  expect(response?.status(), `${route} should return a successful response`).toBeLessThan(400);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator(`#${expectedRootId}`)).toBeVisible();
  await expect(page.getByText(/^Unable to load/i)).toHaveCount(0);
  await expect(page.getByText(/^Application error/i)).toHaveCount(0);
}
