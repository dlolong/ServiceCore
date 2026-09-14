import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { dashboardThemes, resolveDashboardTheme } from "../modules/platform/dashboard-theme";

const source = (path: string) => readFileSync(path, "utf8");

function contrastWithWhite(hex: string) {
  const linear = [1, 3, 5].map(offset => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05);
}

test("dashboard themes expose a small professional allowlist with a safe default", () => {
  assert.deepEqual(dashboardThemes.map(theme => theme.id), ["ocean", "graphite", "emerald", "indigo"]);
  assert.equal(new Set(dashboardThemes.map(theme => theme.id)).size, dashboardThemes.length);
  assert.equal(resolveDashboardTheme("emerald"), "emerald");
  assert.equal(resolveDashboardTheme("invented"), "ocean");
  assert.equal(resolveDashboardTheme(null), "ocean");
  for (const theme of dashboardThemes) assert.ok(contrastWithWhite(theme.swatches[1]) >= 4.5, `${theme.name} primary must support readable white text.`);
});

test("the authenticated user owns a validated theme preference applied at the dashboard shell", () => {
  const context = source("lib/auth/context.ts");
  const action = source("app/dashboard/settings/actions.ts");
  const settings = source("app/dashboard/settings/page.tsx");
  const shell = source("components/app-shell.tsx");
  assert.match(context, /resolveDashboardTheme\(user\.user_metadata\.dashboard_theme\)/);
  assert.match(action, /isDashboardTheme\(theme\)/);
  assert.match(action, /requireAuthenticatedUser/);
  assert.match(action, /supabase\.auth\.updateUser\(\{ data: \{ dashboard_theme: theme \} \}\)/);
  assert.match(settings, /id="settings-theme-form"/);
  assert.match(settings, /id=\{`settings-theme-radio-\$\{theme\.id\}`\}/);
  assert.match(settings, /id="settings-theme-save-button"/);
  assert.match(shell, /data-dashboard-theme=\{dashboardTheme\}/);
});

test("every alternate palette overrides shared tokens without changing semantic status colors", () => {
  const css = source("app/globals.css");
  for (const theme of dashboardThemes.filter(theme => theme.id !== "ocean")) {
    assert.match(css, new RegExp(`\\[data-dashboard-theme="${theme.id}"\\]`));
  }
  for (const block of css.matchAll(/\[data-dashboard-theme="[^"]+"\]\s*\{([^}]+)\}/g)) {
    assert.doesNotMatch(block[1], /--(?:success|warning|danger|info):/);
  }
});

test("Public Page and Billing settings expose clear operational sections", () => {
  const publicPage = source("app/dashboard/settings/public-page/page.tsx");
  const billing = source("app/dashboard/settings/billing/page.tsx");
  for (const id of ["public-page-readiness-card", "public-page-locations-section", "public-gallery-empty-state"]) assert.match(publicPage, new RegExp(id));
  assert.match(publicPage, /Weekly booking hours/);
  assert.doesNotMatch(publicPage, /Opening-hours JSON/);
  assert.match(billing, /id="billing-current-plan"/);
  assert.match(billing, /hasMonthlyCheckout \? <option/);
  assert.match(billing, /hasYearlyCheckout \? <option/);
  assert.match(billing, /billing-checkout-unavailable-/);
  assert.doesNotMatch(billing, /ring-blue-/);
});
