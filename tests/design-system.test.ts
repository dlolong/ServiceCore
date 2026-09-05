import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "../components/ui/button";
import { resolveActiveTabHref, type TabItem } from "../components/ui/tabs";

const read = (path: string) => readFileSync(path, "utf8");

test("design tokens keep admin surfaces neutral and motion respectful", () => {
  const css = read("app/globals.css");
  for (const token of [
    "--admin-surface-raised",
    "--admin-text-secondary",
    "--admin-border-strong",
    "--success",
    "--warning",
    "--danger",
    "--shadow-sm",
    "--shadow-md",
    "--shadow-lg",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
  ]) assert.match(css, new RegExp(token));
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /\.admin-main-surface\s*\{[^}]*linear-gradient/s);
});

test("Button exposes the complete action hierarchy and forwards semantic link attributes", () => {
  const source = read("components/ui/button.tsx");
  for (const variant of ["primary", "secondary", "outline", "ghost", "danger", "destructive"]) {
    assert.match(source, new RegExp(`${variant}:`));
  }
  assert.doesNotMatch(source, /enabled:hover/);
  assert.match(source, /aria-disabled:bg-slate-300/);
  const markup = renderToStaticMarkup(createElement(
    Button,
    {
      asChild: true,
      id: "design-system-action",
      "aria-label": "Open record",
      title: "Open",
      variant: "ghost",
    },
    createElement("a", { href: "/record" }, "Open"),
  ));
  assert.match(markup, /id="design-system-action"/);
  assert.match(markup, /aria-label="Open record"/);
  assert.match(markup, /href="\/record"/);
  assert.doesNotMatch(markup, /type="button"/);

  const disabledMarkup = renderToStaticMarkup(createElement(
    Button,
    { asChild: true, disabled: true },
    createElement("a", { href: "/next" }, "Next"),
  ));
  assert.match(disabledMarkup, /aria-disabled="true"/);
  assert.match(disabledMarkup, /tabindex="-1"/);
  assert.match(disabledMarkup, /aria-disabled:bg-slate-300/);
  assert.doesNotMatch(disabledMarkup, / disabled=/);
});

test("application shell uses one neutral navigation treatment and one main content scroll", () => {
  const shell = read("components/app-shell.tsx");
  assert.doesNotMatch(shell, /navigationImportanceStyles|text-cyan|bg-cyan/);
  assert.match(shell, /const navigationStyles/);
  assert.match(shell, /id="dashboard-main-content"[^>]*overflow-y-auto/);
  assert.match(shell, /pb-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shell, /hidden min-\[360px\]:inline-block/);
  assert.match(shell, /id="negosu-business-switcher"[^>]*hidden items-center gap-2 xl:flex/);
  assert.match(shell, /id="negosu-mobile-business-switcher"[^>]*xl:hidden/);
  assert.doesNotMatch(shell, /id="negosu-business-switcher"[^>]*sm:flex/);
  assert.match(shell, /id="mobile-nav-settings" href="\/dashboard\/settings"/);
  assert.match(shell, /activeHref === "\/dashboard\/settings"/);
  assert.match(shell, /<Settings aria-hidden="true" size=\{20\}\/><span>Settings<\/span>/);
  assert.doesNotMatch(shell, /id="mobile-nav-more"/);
});

test("FormDialog keeps one contained scroll region and routes Escape to stable state", () => {
  const dialog = read("components/management-ui.tsx");
  assert.match(dialog, /onCancel=\{handleCancel\}/);
  assert.match(dialog, /event\.preventDefault\(\)/);
  assert.match(dialog, /router\.replace\(closeHref\)/);
  assert.match(dialog, /id=\{`\$\{id\}-content`\}[^>]*overflow-y-auto/);
  assert.match(dialog, /aria-describedby/);
  assert.match(dialog, /export function DialogFooter/);
});

test("shared tabs and tables preserve visible content and mobile behavior", () => {
  const tabs = read("components/ui/tabs.tsx");
  const table = read("components/ui/table.tsx");
  assert.match(tabs, /overflow-x-auto/);
  assert.match(tabs, /aria-current/);
  assert.match(tabs, /usePathname/);
  assert.match(table, /overflow-x-auto/);
  assert.doesNotMatch(table, /overflow-hidden/);
});

test("Tabs chooses one longest route match and honors explicit state", () => {
  const items: TabItem[] = [
    { id: "overview", label: "Overview", href: "/dashboard/jobs/one" },
    { id: "work", label: "Work", href: "/dashboard/jobs/one/work" },
  ];
  assert.equal(resolveActiveTabHref("/dashboard/jobs/one", items), "/dashboard/jobs/one");
  assert.equal(resolveActiveTabHref("/dashboard/jobs/one/work/details", items), "/dashboard/jobs/one/work");
  assert.equal(resolveActiveTabHref("/dashboard/jobs/two", items), undefined);
  assert.equal(resolveActiveTabHref("/dashboard/jobs/one/work", items.map((item) => ({ ...item, active: item.id === "overview" }))), "/dashboard/jobs/one");
});

test("record and settings layouts use shared path-aware Tabs with semantic IDs", () => {
  const sources = [
    read("app/dashboard/settings/layout.tsx"),
    read("app/dashboard/vehicles/[vehicleId]/layout.tsx"),
    read("app/dashboard/customers/[customerId]/layout.tsx"),
    read("app/dashboard/jobs/[jobId]/layout.tsx"),
  ].join("\n");
  assert.equal((sources.match(/<Tabs/g) ?? []).length, 4);
  for (const id of ["settings-sections-navigation", "vehicle-sections-navigation", "customer-sections-navigation", "job-order-sections-navigation"]) assert.match(sources, new RegExp(id));
  assert.match(sources, /job-order-work-tab-/);
  assert.match(sources, /print:hidden/);
  assert.doesNotMatch(sources, /rounded-xl border bg-white px-4 py-2/);
});

test("design-system documentation records the shared neutral contract", () => {
  const designSystem = read("docs/DESIGN_SYSTEM.md");
  const conventions = read("docs/UI_CONVENTIONS.md");
  assert.match(designSystem, /## Buttons and links/);
  assert.match(designSystem, /## Dialogs/);
  assert.match(designSystem, /320, 375, 390, and 430px/);
  assert.match(conventions, /navigation groups do not receive different decorative colors/i);
});
