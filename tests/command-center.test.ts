import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CommandCenterError,
  composeCommandCenterSnapshot,
  normalizeSharedCommandCenterRows,
  resolveCommandCenterScope,
  sortCommandCenterActions,
} from "../modules/core/command-center/command-center.service";
import type { CommandCenterAction, CommandCenterMembership, SharedCommandCenterSnapshot } from "../modules/core/command-center/command-center.types";

const membership: CommandCenterMembership = {
  organizationId: "10000000-0000-4000-8000-000000000001",
  role: "owner",
  branchId: "20000000-0000-4000-8000-000000000001",
  branchName: "Makati",
  branches: [
    { id: "20000000-0000-4000-8000-000000000001", name: "Makati" },
    { id: "20000000-0000-4000-8000-000000000002", name: "BGC" },
  ],
  currency: "PHP",
};

test("Command Center scope defaults to the active accessible branch", () => {
  assert.deepEqual(resolveCommandCenterScope(membership), {
    mode: "branch",
    organizationId: membership.organizationId,
    branchIds: [membership.branchId],
    selectedBranchId: membership.branchId,
    label: "Makati",
    currency: "PHP",
  });
});

test("all scope contains only branches supplied by the authorized membership", () => {
  const restrictedManager = { ...membership, role: "manager", branches: [membership.branches[1]!] };
  const scope = resolveCommandCenterScope(restrictedManager, "all");
  assert.deepEqual(scope.branchIds, ["20000000-0000-4000-8000-000000000002"]);
  assert.equal(scope.label, "All Branches");
});

test("inaccessible branch and non-manager roles fail closed", () => {
  assert.throws(() => resolveCommandCenterScope(membership, "20000000-0000-4000-8000-000000000099"), CommandCenterError);
  assert.throws(() => resolveCommandCenterScope({ ...membership, role: "advisor" }), /Command Center access denied/);
});

test("shared metric rows normalize money and counts and aggregate authorized branches", () => {
  const scope = resolveCommandCenterScope(membership, "all");
  const result = normalizeSharedCommandCenterRows(scope, [
    { branch_id: membership.branches[0]!.id, branch_name: "Makati", timezone: "Asia/Manila", revenue_today_centavos: "12500", appointments_today: "3", outstanding_centavos: "5000", low_stock_count: "2" },
    { branch_id: membership.branches[1]!.id, branch_name: "BGC", timezone: "Asia/Manila", revenue_today_centavos: 7500, appointments_today: 2, outstanding_centavos: 1000, low_stock_count: 1 },
  ]);
  assert.deepEqual(result.branchPerformance.map(({ branchName }) => branchName), ["BGC", "Makati"]);
  assert.equal(result.metrics.find(({ key }) => key === "revenue_today")?.value, 20000);
  assert.equal(result.metrics.find(({ key }) => key === "appointments_today")?.value, 5);
  assert.equal(result.metrics.find(({ key }) => key === "outstanding")?.value, 6000);
  assert.equal(result.metrics.find(({ key }) => key === "low_stock")?.value, 3);
});

test("unexpected branch data and unsafe money fail closed", () => {
  const scope = resolveCommandCenterScope(membership);
  const baseRow = { branch_id: membership.branchId, branch_name: "Makati", timezone: "Asia/Manila", revenue_today_centavos: 0, appointments_today: 0, outstanding_centavos: 0, low_stock_count: 0 };
  assert.throws(() => normalizeSharedCommandCenterRows(scope, [{ ...baseRow, branch_id: "20000000-0000-4000-8000-000000000099" }]), CommandCenterError);
  assert.throws(() => normalizeSharedCommandCenterRows(scope, [{ ...baseRow, revenue_today_centavos: "9007199254740992" }]), CommandCenterError);
  assert.throws(() => normalizeSharedCommandCenterRows(resolveCommandCenterScope(membership, "all"), [baseRow]), /Branch not available/);
});

test("actions sort by priority, age, then stable id", () => {
  const actions: CommandCenterAction[] = [
    { id: "medium", code: "M", priority: "medium", title: "Medium", href: "/m" },
    { id: "high-new", code: "H2", priority: "high", title: "High new", href: "/h2", createdAt: "2026-09-03T02:00:00Z" },
    { id: "high-old", code: "H1", priority: "high", title: "High old", href: "/h1", createdAt: "2026-09-03T01:00:00Z" },
    { id: "critical", code: "C", priority: "critical", title: "Critical", href: "/c" },
  ];
  assert.deepEqual(sortCommandCenterActions(actions).map(({ id }) => id), ["critical", "high-old", "high-new", "medium"]);
});

test("composition derives attention totals without persistent Action Inbox state", () => {
  const scope = resolveCommandCenterScope(membership);
  const shared: SharedCommandCenterSnapshot = {
    scope,
    ...normalizeSharedCommandCenterRows(scope, [{ branch_id: membership.branchId, branch_name: "Makati", timezone: "Asia/Manila", revenue_today_centavos: 0, appointments_today: 0, outstanding_centavos: 0, low_stock_count: 0 }]),
    actions: [], operations: [], staff: [],
  };
  const result = composeCommandCenterSnapshot(shared, { actions: [
    { id: "approval", code: "WAITING", priority: "high", title: "Waiting", count: 3, href: "/dashboard", branchId: membership.branchId },
    { id: "stock", code: "STOCK", priority: "medium", title: "Stock", href: "/dashboard/inventory", branchId: membership.branchId },
  ] });
  assert.equal(result.metrics.find(({ key }) => key === "attention")?.value, 4);
  assert.equal(result.branchPerformance[0]?.attentionCount, 4);
});

test("Core Command Center has no vertical runtime or domain dependency", () => {
  const source = [
    readFileSync("modules/core/command-center/command-center.types.ts", "utf8"),
    readFileSync("modules/core/command-center/command-center.service.ts", "utf8"),
    readFileSync("modules/core/command-center/command-center.runtime.ts", "utf8"),
    readFileSync("supabase/migrations/0054_shared_command_center_metrics.sql", "utf8"),
  ].join("\n");
  assert.doesNotMatch(source, /modules\/(automotive|salon)|vehicle|job_order|maintenance|inspection/i);
  assert.doesNotMatch(source, /action_inbox_items/);
});
