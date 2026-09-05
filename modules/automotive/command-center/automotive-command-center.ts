import type {
  CommandCenterAction,
  CommandCenterOperation,
  CommandCenterStaffItem,
} from "@/modules/core/command-center";
import { dashboardBranchContextHref } from "@/modules/platform/command-center-branch-context";

export const automotiveActionJobStatuses = ["queued", "quality_check", "ready", "ready_for_release"] as const;
export const automotiveActiveJobStatuses = ["awaiting_approval", "approved", "queued", "in_progress", "on_hold", "quality_check", "ready", "ready_for_release"] as const;

export type AutomotiveJobCandidate = {
  id: string;
  branchId: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  promisedAt: string | null;
  appointmentId: string | null;
  jobNumber: number | null;
  vehicle: string;
  customer: string;
  serviceSummary: string;
};

export type AutomotiveEstimateCandidate = {
  id: string;
  jobOrderId: string;
  branchId: string;
  createdAt: string;
  jobNumber: number | null;
  vehicle: string;
};

export type AutomotiveInvoiceCandidate = {
  id: string;
  jobOrderId: string;
  branchId: string;
  createdAt: string;
  balanceCentavos: number;
  jobNumber: number | null;
  vehicle: string;
};

export type AutomotiveMaintenanceCandidate = {
  id: string;
  branchId: string;
  dueAt: string;
  serviceName: string;
  vehicle: string;
};

export type AutomotiveAppointmentCandidate = {
  id: string;
  branchId: string;
  startsAt: string | null;
  status: string;
  vehicle: string;
  customer: string;
  serviceSummary: string;
  staffSummary?: string;
  resourceSummary?: string;
};

export type AutomotiveStaffCandidate = {
  id: string;
  branchId?: string;
  displayName: string;
  activeJobId?: string;
  activeJobLabel?: string;
  nextAppointmentId?: string;
  nextAppointmentAt?: string;
  nextAppointmentLabel?: string;
};

export function deriveAutomotiveActions(input: {
  jobs: readonly AutomotiveJobCandidate[];
  estimates: readonly AutomotiveEstimateCandidate[];
  invoices: readonly AutomotiveInvoiceCandidate[];
  maintenance: readonly AutomotiveMaintenanceCandidate[];
  lowStockByBranch: ReadonlyMap<string, number>;
}): CommandCenterAction[] {
  const actions: CommandCenterAction[] = [];

  for (const estimate of input.estimates) {
    actions.push({
      id: `estimate-awaiting-${estimate.id}`,
      code: "AUTOMOTIVE_ESTIMATE_AWAITING_CUSTOMER",
      priority: "high",
      title: `${jobLabel(estimate.jobNumber)} estimate awaiting approval`,
      description: `${estimate.vehicle} is waiting for the customer’s decision.`,
      href: `/dashboard/jobs/${estimate.jobOrderId}#job-order-estimate-section`,
      createdAt: estimate.createdAt,
      branchId: estimate.branchId,
    });
  }

  for (const job of input.jobs) {
    if (job.status === "queued") {
      actions.push({
        id: `job-queued-${job.id}`,
        code: "AUTOMOTIVE_JOB_WAITING_TO_START",
        priority: "medium",
        title: `${jobLabel(job.jobNumber)} is waiting to start`,
        description: `${job.vehicle} · ${job.customer}`,
        href: `/dashboard/jobs/${job.id}#job-order-work-tracking-section`,
        createdAt: job.createdAt,
        branchId: job.branchId,
      });
    } else if (job.status === "quality_check") {
      actions.push({
        id: `job-quality-check-${job.id}`,
        code: "AUTOMOTIVE_JOB_QUALITY_CHECK",
        priority: "high",
        title: `${jobLabel(job.jobNumber)} needs quality check`,
        description: job.vehicle,
        href: `/dashboard/jobs/${job.id}`,
        createdAt: job.startedAt ?? job.createdAt,
        branchId: job.branchId,
      });
    } else if (job.status === "ready" || job.status === "ready_for_release") {
      actions.push({
        id: `job-ready-${job.id}`,
        code: "AUTOMOTIVE_VEHICLE_READY",
        priority: "high",
        title: `${job.vehicle} is ready for release`,
        description: jobLabel(job.jobNumber),
        href: `/dashboard/jobs/${job.id}`,
        createdAt: job.startedAt ?? job.createdAt,
        branchId: job.branchId,
      });
    }
  }

  for (const invoice of input.invoices) {
    if (invoice.balanceCentavos <= 0) continue;
    actions.push({
      id: `invoice-balance-${invoice.id}`,
      code: "AUTOMOTIVE_COMPLETED_INVOICE_BALANCE",
      priority: "high",
      title: `${jobLabel(invoice.jobNumber)} has an outstanding balance`,
      description: invoice.vehicle,
      href: `/dashboard/invoices/${invoice.id}`,
      createdAt: invoice.createdAt,
      branchId: invoice.branchId,
    });
  }

  for (const item of input.maintenance) {
    actions.push({
      id: `maintenance-overdue-${item.id}`,
      code: "AUTOMOTIVE_MAINTENANCE_OVERDUE",
      priority: "medium",
      title: `${item.serviceName} is overdue`,
      description: item.vehicle,
      href: `/dashboard/reminders?id=${item.id}`,
      createdAt: item.dueAt,
      branchId: item.branchId,
    });
  }

  for (const [branchId, count] of input.lowStockByBranch) {
    if (count <= 0) continue;
    actions.push({
      id: `inventory-low-stock-${branchId}`,
      code: "SHARED_LOW_STOCK",
      priority: "medium",
      title: `${count} ${count === 1 ? "item is" : "items are"} low on stock`,
      description: "Review current inventory thresholds.",
      count,
      href: dashboardBranchContextHref(branchId, "/dashboard/inventory"),
      branchId,
    });
  }

  return actions;
}

export function deriveAutomotiveOperations(
  appointments: readonly AutomotiveAppointmentCandidate[],
  jobs: readonly AutomotiveJobCandidate[],
): CommandCenterOperation[] {
  const jobAppointmentIds = new Set(jobs.map(({ appointmentId }) => appointmentId).filter(Boolean));
  const appointmentOperations = appointments
    .filter(({ id }) => !jobAppointmentIds.has(id))
    .map((appointment): CommandCenterOperation => ({
      id: `appointment-${appointment.id}`,
      title: appointment.vehicle,
      subject: appointment.customer,
      startsAt: appointment.startsAt,
      status: appointment.status,
      serviceSummary: appointment.serviceSummary,
      staffSummary: appointment.staffSummary,
      resourceSummary: appointment.resourceSummary,
      href: `/dashboard/appointments/${appointment.id}`,
      branchId: appointment.branchId,
    }));
  const jobOperations = jobs.map((job): CommandCenterOperation => ({
    id: `job-${job.id}`,
    title: job.vehicle,
    subject: `${jobLabel(job.jobNumber)} · ${job.customer}`,
    startsAt: job.promisedAt ?? job.startedAt ?? job.createdAt,
    status: job.status,
    serviceSummary: job.serviceSummary,
    href: `/dashboard/jobs/${job.id}`,
    branchId: job.branchId,
  }));

  return [...appointmentOperations, ...jobOperations]
    .sort((left, right) => sortableTime(left.startsAt) - sortableTime(right.startsAt) || left.id.localeCompare(right.id))
    .slice(0, 12);
}

export function deriveAutomotiveStaff(candidates: readonly AutomotiveStaffCandidate[]): CommandCenterStaffItem[] {
  return candidates.map((staff): CommandCenterStaffItem => {
    if (staff.activeJobId) {
      return {
        id: staff.id,
        displayName: staff.displayName,
        status: "working",
        context: staff.activeJobLabel ?? "Working on a Job Order",
        href: `/dashboard/jobs/${staff.activeJobId}`,
        branchId: staff.branchId,
      };
    }
    return {
      id: staff.id,
      displayName: staff.displayName,
      status: "available",
      context: staff.nextAppointmentLabel ? `Next: ${staff.nextAppointmentLabel}` : "No upcoming assigned work",
      nextAt: staff.nextAppointmentAt,
      href: staff.nextAppointmentId ? `/dashboard/appointments/${staff.nextAppointmentId}` : undefined,
      branchId: staff.branchId,
    };
  }).sort((left, right) => staffRank(left.status) - staffRank(right.status) || left.displayName.localeCompare(right.displayName));
}

function jobLabel(jobNumber: number | null) {
  return jobNumber == null ? "Job Order" : `Job #${jobNumber}`;
}

function sortableTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function staffRank(status: CommandCenterStaffItem["status"]) {
  return { working: 0, busy: 1, available: 2, off: 3 }[status];
}
