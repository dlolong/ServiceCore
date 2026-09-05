import "server-only";

import { zonedDateTimeToUtc } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import {
  composeCommandCenterSnapshot,
  type SharedCommandCenterSnapshot,
} from "@/modules/core/command-center";
import { assignmentContextLabel, loadAppointmentAssignmentContext } from "@/modules/core/scheduling/appointment-assignment-view";
import {
  deriveSalonActions,
  deriveSalonOperations,
  deriveSalonStaff,
  salonCommandCenterStatuses,
  type SalonAppointmentCandidate,
  type SalonStaffCandidate,
} from "@/modules/salon/command-center/salon-command-center";

export type SalonCommandCenterResult = {
  snapshot: SharedCommandCenterSnapshot;
  sectionErrors: Partial<Record<"actions" | "operations" | "staff", string>>;
};

export async function getSalonCommandCenter(shared: SharedCommandCenterSnapshot): Promise<SalonCommandCenterResult> {
  const supabase = await createClient();
  const windows = shared.branchPerformance.map(({ branchId, timezone }) => ({ branchId, ...todayWindow(timezone) }));
  const earliestToday = Math.min(...windows.map(({ start }) => start.valueOf()));
  const minStart = new Date(earliestToday - 31 * 86_400_000).toISOString();
  const maxEnd = new Date(Math.max(...windows.map(({ end }) => end.valueOf())) + 31 * 86_400_000).toISOString();
  // The aggregate RPC is the final branch-authorization boundary. Compose
  // vertical reads only from the branch rows it actually returned.
  const branchIds = shared.branchPerformance.map(({ branchId }) => branchId);
  const [appointmentsResult, staffResult] = await Promise.all([
    supabase.from("appointments")
      .select("id,branch_id,starts_at,ends_at,status,expected_total_centavos,created_at,customers(full_name),appointment_services(service_name_snapshot)")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).in("status", [...salonCommandCenterStatuses])
      .gte("starts_at", minStart).lt("starts_at", maxEnd).order("starts_at").limit(300),
    supabase.from("staff_directory")
      .select("staff_id,full_name,job_function,branch_ids")
      .eq("organization_id", shared.scope.organizationId).eq("is_active", true)
      .order("full_name").limit(200),
  ]);
  const rawAppointments = (appointmentsResult.data ?? []) as unknown as RawAppointment[];
  const appointmentIds = rawAppointments.map(({ id }) => id);
  const [assignmentContext, paymentsResult] = await Promise.all([
    loadAppointmentAssignmentContext(shared.scope.organizationId, appointmentIds),
    appointmentIds.length
      ? supabase.from("payments").select("appointment_id,amount_centavos,status")
        .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).in("appointment_id", appointmentIds).limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const paidByAppointment = new Map<string, number>();
  for (const payment of paymentsResult.data ?? []) {
    if (payment.status !== "paid" || !payment.appointment_id) continue;
    paidByAppointment.set(payment.appointment_id, (paidByAppointment.get(payment.appointment_id) ?? 0) + Number(payment.amount_centavos));
  }
  const appointments = rawAppointments.map((appointment): SalonAppointmentCandidate => {
    const context = assignmentContext.get(appointment.id) ?? { scheduledStaff: [], scheduledResources: [] };
    return {
      id: appointment.id,
      branchId: appointment.branch_id,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      status: appointment.status,
      client: one(appointment.customers)?.full_name ?? "Client",
      treatmentSummary: appointment.appointment_services.map(({ service_name_snapshot }) => service_name_snapshot).join(", ") || "Treatment not assigned",
      staff: context.scheduledStaff,
      resourceSummary: assignmentContextLabel(context).resources,
      expectedTotalCentavos: Number(appointment.expected_total_centavos),
      paidCentavos: paidByAppointment.get(appointment.id) ?? 0,
      createdAt: appointment.created_at,
    };
  });
  const staff = ((staffResult.data ?? []) as unknown as RawStaff[])
    .filter((member) => memberInScope(member.branch_ids, branchIds))
    .map((member): SalonStaffCandidate => ({
      id: member.staff_id,
      displayName: member.full_name,
      jobFunction: member.job_function ?? undefined,
    }));
  const lowStockByBranch = new Map(shared.branchPerformance.map(({ branchId, lowStockCount }) => [branchId, lowStockCount]));
  const todayAppointments = appointments.filter((appointment) => inBranchToday(appointment.branchId, appointment.startsAt, windows));
  const snapshot = composeCommandCenterSnapshot({
    ...shared,
    metrics: shared.metrics.map((metric) => metric.key === "outstanding"
      ? { ...metric, href: "/dashboard/appointments?status=completed" }
      : metric),
  }, {
    actions: deriveSalonActions(appointments, lowStockByBranch),
    operations: deriveSalonOperations(todayAppointments),
    staff: deriveSalonStaff(staff, appointments.filter(({ startsAt }) => Boolean(startsAt && Date.parse(startsAt) >= earliestToday))),
  });

  return {
    snapshot,
    sectionErrors: {
      ...(appointmentsResult.error || paymentsResult.error ? { actions: "Some Salon action items could not be loaded." } : {}),
      ...(appointmentsResult.error ? { operations: "Some of today’s Salon appointments could not be loaded." } : {}),
      ...(staffResult.error ? { staff: "Some Staff availability could not be loaded." } : {}),
    },
  };
}

type RawAppointment = {
  id: string;
  branch_id: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  expected_total_centavos: number;
  created_at: string;
  customers: { full_name: string } | { full_name: string }[] | null;
  appointment_services: Array<{ service_name_snapshot: string }>;
};
type RawStaff = { staff_id: string; full_name: string; job_function: string | null; branch_ids: string[] };

function todayWindow(timeZone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const parts = today.split("-").map(Number);
  const next = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]! + 1));
  const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return { start: zonedDateTimeToUtc(`${today}T00:00`, timeZone)!, end: zonedDateTimeToUtc(`${nextDay}T00:00`, timeZone)! };
}

function inBranchToday(branchId: string, startsAt: string | null, windows: Array<{ branchId: string; start: Date; end: Date }>) {
  if (!startsAt) return false;
  const timestamp = Date.parse(startsAt);
  const window = windows.find((item) => item.branchId === branchId);
  return Boolean(window && timestamp >= window.start.valueOf() && timestamp < window.end.valueOf());
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function memberInScope(assignments: string[], branchIds: readonly string[]) {
  return assignments.length === 0 || assignments.some((branchId) => branchIds.includes(branchId));
}
