import type {
  CommandCenterAction,
  CommandCenterOperation,
  CommandCenterStaffItem,
} from "@/modules/core/command-center";
import { dashboardBranchContextHref } from "@/modules/platform/command-center-branch-context";

export const salonCommandCenterStatuses = ["requested", "confirmed", "checked_in", "in_service", "completed"] as const;

export type SalonAppointmentCandidate = {
  id: string;
  branchId: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  client: string;
  treatmentSummary: string;
  staff: Array<{ id: string; displayName: string }>;
  resourceSummary?: string;
  expectedTotalCentavos: number;
  paidCentavos: number;
  createdAt: string;
};

export type SalonStaffCandidate = {
  id: string;
  displayName: string;
  jobFunction?: string;
  branchId?: string;
};

export function deriveSalonActions(
  appointments: readonly SalonAppointmentCandidate[],
  lowStockByBranch: ReadonlyMap<string, number>,
): CommandCenterAction[] {
  const actions: CommandCenterAction[] = [];
  for (const appointment of appointments) {
    if (appointment.status === "requested") {
      actions.push({
        id: `appointment-requested-${appointment.id}`,
        code: "SALON_APPOINTMENT_UNCONFIRMED",
        priority: "high",
        title: `${appointment.client} is awaiting confirmation`,
        description: appointment.treatmentSummary,
        href: `/dashboard/appointments/${appointment.id}`,
        createdAt: appointment.createdAt,
        branchId: appointment.branchId,
      });
    } else if (appointment.status === "checked_in") {
      actions.push({
        id: `appointment-checked-in-${appointment.id}`,
        code: "SALON_CLIENT_WAITING",
        priority: "high",
        title: `${appointment.client} is checked in`,
        description: appointment.treatmentSummary,
        href: `/dashboard/appointments/${appointment.id}`,
        createdAt: appointment.startsAt ?? appointment.createdAt,
        branchId: appointment.branchId,
      });
    } else if (appointment.status === "completed") {
      const balance = Math.max(0, appointment.expectedTotalCentavos - appointment.paidCentavos);
      if (balance > 0) {
        actions.push({
          id: `appointment-balance-${appointment.id}`,
          code: "SALON_COMPLETED_APPOINTMENT_BALANCE",
          priority: "high",
          title: `${appointment.client} has a remaining balance`,
          description: appointment.treatmentSummary,
          href: `/dashboard/appointments/${appointment.id}#salon-appointment-payment`,
          createdAt: appointment.startsAt ?? appointment.createdAt,
          branchId: appointment.branchId,
        });
      }
    }
  }

  for (const [branchId, count] of lowStockByBranch) {
    if (count <= 0) continue;
    actions.push({
      id: `inventory-low-stock-${branchId}`,
      code: "SHARED_LOW_STOCK",
      priority: "medium",
      title: `${count} ${count === 1 ? "product is" : "products are"} low on stock`,
      description: "Review current inventory thresholds.",
      count,
      href: dashboardBranchContextHref(branchId, "/dashboard/inventory"),
      branchId,
    });
  }
  return actions;
}

export function deriveSalonOperations(appointments: readonly SalonAppointmentCandidate[]): CommandCenterOperation[] {
  return appointments.map((appointment): CommandCenterOperation => ({
    id: `appointment-${appointment.id}`,
    title: appointment.client,
    subject: appointment.treatmentSummary,
    startsAt: appointment.startsAt,
    status: appointment.status,
    serviceSummary: appointment.treatmentSummary,
    staffSummary: appointment.staff.map(({ displayName }) => displayName).join(", ") || "Unassigned",
    resourceSummary: appointment.resourceSummary,
    href: `/dashboard/appointments/${appointment.id}`,
    branchId: appointment.branchId,
  })).sort((left, right) => sortableTime(left.startsAt) - sortableTime(right.startsAt) || left.id.localeCompare(right.id)).slice(0, 12);
}

export function deriveSalonStaff(
  staffRows: readonly SalonStaffCandidate[],
  appointments: readonly SalonAppointmentCandidate[],
  now = new Date(),
): CommandCenterStaffItem[] {
  const activeStatuses = new Set(["checked_in", "in_service"]);
  return staffRows.map((staff): CommandCenterStaffItem => {
    const assigned = appointments
      .filter((appointment) => appointment.staff.some(({ id }) => id === staff.id))
      .sort((left, right) => sortableTime(left.startsAt) - sortableTime(right.startsAt));
    const current = assigned.find((appointment) => activeStatuses.has(appointment.status)
      || Boolean(appointment.startsAt && appointment.endsAt && Date.parse(appointment.startsAt) <= now.valueOf() && Date.parse(appointment.endsAt) > now.valueOf()));
    const next = assigned.find((appointment) => appointment.startsAt && Date.parse(appointment.startsAt) > now.valueOf());
    if (current) {
      return {
        id: staff.id,
        displayName: staff.displayName,
        status: "busy",
        context: `${current.client} · ${current.treatmentSummary}`,
        href: `/dashboard/appointments/${current.id}`,
        branchId: current.branchId,
      };
    }
    return {
      id: staff.id,
      displayName: staff.displayName,
      status: "available",
      context: next ? `Next: ${next.client} · ${next.treatmentSummary}` : (staff.jobFunction ?? "No upcoming Appointment"),
      nextAt: next?.startsAt ?? undefined,
      href: next ? `/dashboard/appointments/${next.id}` : undefined,
      branchId: next?.branchId ?? staff.branchId,
    };
  }).sort((left, right) => staffRank(left.status) - staffRank(right.status) || left.displayName.localeCompare(right.displayName));
}

function sortableTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function staffRank(status: CommandCenterStaffItem["status"]) {
  return { working: 0, busy: 1, available: 2, off: 3 }[status];
}
