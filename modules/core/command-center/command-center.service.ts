import type {
  CommandCenterAction,
  CommandCenterBranchPerformance,
  CommandCenterMembership,
  CommandCenterMetric,
  CommandCenterScope,
  SharedCommandCenterMetricRow,
  SharedCommandCenterSnapshot,
} from "@/modules/core/command-center/command-center.types";

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
const commandCenterRoles = new Set(["owner", "manager"]);

export class CommandCenterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandCenterError";
  }
}

export function resolveCommandCenterScope(
  membership: CommandCenterMembership,
  requestedBranch?: string | null,
): CommandCenterScope {
  if (!commandCenterRoles.has(membership.role)) throw new CommandCenterError("Command Center access denied.");

  const branches = [...new Map(membership.branches.map((branch) => [branch.id, branch])).values()];
  if (branches.length === 0) throw new CommandCenterError("No available branches.");

  if (requestedBranch === "all") {
    return {
      mode: "all",
      organizationId: membership.organizationId,
      branchIds: branches.map(({ id }) => id),
      selectedBranchId: null,
      label: "All Branches",
      currency: membership.currency,
    };
  }

  const branchId = requestedBranch || membership.branchId;
  const branch = branches.find(({ id }) => id === branchId);
  if (!branch) throw new CommandCenterError("Branch not available.");

  return {
    mode: "branch",
    organizationId: membership.organizationId,
    branchIds: [branch.id],
    selectedBranchId: branch.id,
    label: branch.name || membership.branchName,
    currency: membership.currency,
  };
}

export function normalizeSharedCommandCenterRows(
  scope: CommandCenterScope,
  rows: readonly SharedCommandCenterMetricRow[],
): Pick<SharedCommandCenterSnapshot, "metrics" | "branchPerformance"> {
  const allowedIds = new Set(scope.branchIds);
  const seenIds = new Set<string>();
  const branchPerformance = rows.map((row): CommandCenterBranchPerformance => {
    if (!allowedIds.has(row.branch_id) || seenIds.has(row.branch_id)) throw new CommandCenterError("Command Center data is invalid.");
    seenIds.add(row.branch_id);
    return {
      branchId: row.branch_id,
      branchName: row.branch_name,
      timezone: row.timezone,
      revenueTodayCentavos: normalizeNonNegativeInteger(row.revenue_today_centavos),
      appointmentsToday: normalizeNonNegativeInteger(row.appointments_today),
      outstandingCentavos: normalizeNonNegativeInteger(row.outstanding_centavos),
      lowStockCount: normalizeNonNegativeInteger(row.low_stock_count),
      attentionCount: 0,
    };
  }).sort((left, right) => left.branchName.localeCompare(right.branchName));

  if (seenIds.size !== allowedIds.size || [...allowedIds].some((branchId) => !seenIds.has(branchId))) {
    throw new CommandCenterError("Branch not available.");
  }

  const totals = branchPerformance.reduce((sum, branch) => ({
    revenue: sum.revenue + branch.revenueTodayCentavos,
    appointments: sum.appointments + branch.appointmentsToday,
    outstanding: sum.outstanding + branch.outstandingCentavos,
    lowStock: sum.lowStock + branch.lowStockCount,
  }), { revenue: 0, appointments: 0, outstanding: 0, lowStock: 0 });

  const metrics: CommandCenterMetric[] = [
    { key: "revenue_today", label: "Revenue Today", value: totals.revenue, valueKind: "currency", helperText: "Paid payments received today" },
    { key: "appointments_today", label: "Appointments Today", value: totals.appointments, valueKind: "count", helperText: "By each branch’s local date", href: "/dashboard/appointments" },
    { key: "outstanding", label: "Outstanding", value: totals.outstanding, valueKind: "currency", helperText: "Open invoice and completed Appointment balances", href: "/dashboard/payments" },
    { key: "low_stock", label: "Low Stock", value: totals.lowStock, valueKind: "count", helperText: "Using existing inventory thresholds", href: "/dashboard/inventory" },
  ];

  return { metrics, branchPerformance };
}

export function composeCommandCenterSnapshot(
  shared: SharedCommandCenterSnapshot,
  contribution: Partial<Pick<SharedCommandCenterSnapshot, "actions" | "operations" | "staff">>,
): SharedCommandCenterSnapshot {
  const actions = sortCommandCenterActions(contribution.actions ?? shared.actions);
  const countsByBranch = new Map<string, number>();
  for (const action of actions) if (action.branchId) countsByBranch.set(action.branchId, (countsByBranch.get(action.branchId) ?? 0) + (action.count ?? 1));
  const attention: CommandCenterMetric = {
    key: "attention",
    label: "Needs Attention",
    value: actions.reduce((count, action) => count + (action.count ?? 1), 0),
    valueKind: "count",
    helperText: "Current operational conditions",
  };

  return {
    ...shared,
    metrics: [...shared.metrics.filter(({ key }) => key !== "attention"), attention],
    actions,
    operations: contribution.operations ?? shared.operations,
    staff: contribution.staff ?? shared.staff,
    branchPerformance: shared.branchPerformance.map((branch) => ({ ...branch, attentionCount: countsByBranch.get(branch.branchId) ?? 0 })),
  };
}

export function sortCommandCenterActions(actions: readonly CommandCenterAction[]) {
  return [...actions].sort((left, right) => {
    const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    const leftTime = actionTime(left.createdAt);
    const rightTime = actionTime(right.createdAt);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });
}

function actionTime(value?: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function normalizeNonNegativeInteger(value: number | string) {
  const normalized = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) throw new CommandCenterError("Command Center data is invalid.");
  return normalized;
}
