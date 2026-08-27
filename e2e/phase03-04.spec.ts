import { expect, test } from "@playwright/test";

test("protected operations routes redirect unauthenticated users", async ({ page }) => {
  for (const route of ["/dashboard/services", "/dashboard/appointments", "/dashboard/queue"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  }
});

test("authentication actions and links remain visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
});

test("mobile authentication controls do not overflow or disappear", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only visual boundary check");
  await page.goto("/login");
  const controls=page.locator("a:visible, button:visible");
  await expect(controls).not.toHaveCount(0);
  for (const control of await controls.all()) {
    const box=await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x+box!.width).toBeLessThanOrEqual(412);
  }
});
