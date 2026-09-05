export type CommandCenterPriority = "critical" | "high" | "medium" | "low";

export type CommandCenterMetric = {
  key: string;
  label: string;
  value: number;
  valueKind: "currency" | "count";
  helperText?: string;
  href?: string;
};

export type CommandCenterAction = {
  id: string;
  code: string;
  priority: CommandCenterPriority;
  title: string;
  description?: string;
  count?: number;
  href: string;
  createdAt?: string;
  branchId?: string;
};

export type CommandCenterOperation = {
  id: string;
  title: string;
  subject: string;
  startsAt: string | null;
  status: string;
  serviceSummary?: string;
  staffSummary?: string;
  resourceSummary?: string;
  href: string;
  branchId: string;
};

export type CommandCenterStaffItem = {
  id: string;
  displayName: string;
  status: "working" | "busy" | "available" | "off";
  context?: string;
  nextAt?: string;
  href?: string;
  branchId?: string;
};

export type CommandCenterBranchPerformance = {
  branchId: string;
  branchName: string;
  timezone: string;
  revenueTodayCentavos: number;
  appointmentsToday: number;
  outstandingCentavos: number;
  lowStockCount: number;
  attentionCount: number;
};

export type CommandCenterScope = {
  mode: "branch" | "all";
  organizationId: string;
  branchIds: string[];
  selectedBranchId: string | null;
  label: string;
  currency: string;
};

export type SharedCommandCenterSnapshot = {
  scope: CommandCenterScope;
  metrics: CommandCenterMetric[];
  actions: CommandCenterAction[];
  operations: CommandCenterOperation[];
  staff: CommandCenterStaffItem[];
  branchPerformance: CommandCenterBranchPerformance[];
};

export type CommandCenterBranch = {
  id: string;
  name: string;
};

export type CommandCenterMembership = {
  organizationId: string;
  role: string;
  branchId: string;
  branchName: string;
  branches: readonly CommandCenterBranch[];
  currency: string;
};

export type SharedCommandCenterMetricRow = {
  branch_id: string;
  branch_name: string;
  timezone: string;
  revenue_today_centavos: number | string;
  appointments_today: number | string;
  outstanding_centavos: number | string;
  low_stock_count: number | string;
};
