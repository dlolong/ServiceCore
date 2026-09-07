import "server-only";

import { getDashboardContext } from "@/lib/auth/context";
import { zonedDateTimeToUtc } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { isMissingCommandCenterMetrics, type DatabaseError } from "@/lib/supabase/schema-compatibility";
import {
  calculateCommandCenterOutstanding,
  normalizeSharedCommandCenterRows,
  resolveCommandCenterScope,
  sumCommandCenterCentavos,
} from "@/modules/core/command-center/command-center.service";
import type { CommandCenterScope, SharedCommandCenterMetricRow, SharedCommandCenterSnapshot } from "@/modules/core/command-center/command-center.types";

const compatibilityPageSize = 1_000;

export async function getSharedCommandCenterSnapshot(requestedBranch?: string | null): Promise<SharedCommandCenterSnapshot> {
  const { activeMembership } = await getDashboardContext();
  const scope = resolveCommandCenterScope(activeMembership, requestedBranch);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_command_center_shared_metrics", {
    p_organization_id: scope.organizationId,
    p_branch_ids: scope.branchIds,
  });

  if (error && !isMissingCommandCenterMetrics(error)) {
    throw new Error("Unable to load Command Center metrics.", { cause: error });
  }

  // Migration 0054 remains the preferred, aggregate persistence boundary. The
  // bounded fallback keeps rolling deployments usable when application code is
  // deployed before that migration. Every read still runs as the authenticated
  // actor under existing RLS and is restricted to the resolved branch scope.
  const rows = error
    ? await loadLegacySharedMetrics(scope, supabase)
    : (data ?? []) as SharedCommandCenterMetricRow[];
  const { metrics, branchPerformance } = normalizeSharedCommandCenterRows(scope, rows);

  return { scope, metrics, branchPerformance, actions: [], operations: [], staff: [] };
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type BranchRow = { id: string; name: string; timezone: string };
type PaymentRow = { branch_id: string; appointment_id: string | null; amount_centavos: number | string; paid_at: string | null };
type AppointmentRow = { id: string; branch_id: string; starts_at: string | null; expected_total_centavos: number | string };
type InvoiceRow = { branch_id: string; balance_centavos: number | string };
type StockRow = { branch_id: string };

async function loadLegacySharedMetrics(scope: CommandCenterScope, supabase: SupabaseClient): Promise<SharedCommandCenterMetricRow[]> {
  const { data: branches, error: branchError } = await supabase.from("branches")
    .select("id,name,timezone")
    .eq("organization_id", scope.organizationId)
    .in("id", scope.branchIds)
    .eq("is_active", true);
  if (branchError) throw compatibilityLoadError(branchError);

  const branchRows = (branches ?? []) as BranchRow[];
  const windows = branchRows.map((branch) => ({ branchId: branch.id, ...branchDayWindow(branch.timezone) }));
  if (!windows.length) return [];
  const minimumStart = new Date(Math.min(...windows.map(({ start }) => start.valueOf()))).toISOString();
  const maximumEnd = new Date(Math.max(...windows.map(({ end }) => end.valueOf()))).toISOString();

  const [todayPayments, todayAppointments, invoices, completedAppointments, appointmentPayments, lowStock] = await Promise.all([
    loadAllPages<PaymentRow>((from, to) => supabase.from("payments")
      .select("branch_id,appointment_id,amount_centavos,paid_at")
      .eq("organization_id", scope.organizationId).in("branch_id", scope.branchIds).eq("status", "paid")
      .gte("paid_at", minimumStart).lt("paid_at", maximumEnd).range(from, to)),
    loadAllPages<AppointmentRow>((from, to) => supabase.from("appointments")
      .select("id,branch_id,starts_at,expected_total_centavos")
      .eq("organization_id", scope.organizationId).in("branch_id", scope.branchIds)
      .gte("starts_at", minimumStart).lt("starts_at", maximumEnd).range(from, to)),
    loadAllPages<InvoiceRow>((from, to) => supabase.from("invoices")
      .select("branch_id,balance_centavos")
      .eq("organization_id", scope.organizationId).in("branch_id", scope.branchIds)
      .neq("status", "void").gt("balance_centavos", 0).range(from, to)),
    loadAllPages<AppointmentRow>((from, to) => supabase.from("appointments")
      .select("id,branch_id,starts_at,expected_total_centavos")
      .eq("organization_id", scope.organizationId).in("branch_id", scope.branchIds)
      .eq("status", "completed").range(from, to)),
    loadAllPages<PaymentRow>((from, to) => supabase.from("payments")
      .select("branch_id,appointment_id,amount_centavos,paid_at")
      .eq("organization_id", scope.organizationId).in("branch_id", scope.branchIds)
      .eq("status", "paid").not("appointment_id", "is", null).range(from, to)),
    loadAllPages<StockRow>((from, to) => supabase.from("inventory_stock")
      .select("branch_id")
      .eq("organization_id", scope.organizationId).in("branch_id", scope.branchIds)
      .eq("low_stock", true).range(from, to)),
  ]);

  const paidByAppointment = new Map<string, Array<number | string>>();
  for (const payment of appointmentPayments) {
    if (!payment.appointment_id) continue;
    const amounts = paidByAppointment.get(payment.appointment_id) ?? [];
    amounts.push(payment.amount_centavos);
    paidByAppointment.set(payment.appointment_id, amounts);
  }

  return branchRows.map((branch): SharedCommandCenterMetricRow => {
    const window = windows.find(({ branchId }) => branchId === branch.id)!;
    const isInsideWindow = (value: string | null) => {
      if (!value) return false;
      const timestamp = Date.parse(value);
      return timestamp >= window.start.valueOf() && timestamp < window.end.valueOf();
    };
    const appointmentOutstanding = completedAppointments
      .filter(({ branch_id }) => branch_id === branch.id)
      .map((appointment) => calculateCommandCenterOutstanding(
        appointment.expected_total_centavos,
        paidByAppointment.get(appointment.id) ?? [],
      ));
    const invoiceOutstanding = invoices
      .filter(({ branch_id }) => branch_id === branch.id)
      .map(({ balance_centavos }) => balance_centavos);
    return {
      branch_id: branch.id,
      branch_name: branch.name,
      timezone: branch.timezone,
      revenue_today_centavos: sumCommandCenterCentavos(todayPayments
        .filter((payment) => payment.branch_id === branch.id && isInsideWindow(payment.paid_at))
        .map(({ amount_centavos }) => amount_centavos)),
      appointments_today: todayAppointments
        .filter((appointment) => appointment.branch_id === branch.id && isInsideWindow(appointment.starts_at)).length,
      outstanding_centavos: sumCommandCenterCentavos([...invoiceOutstanding, ...appointmentOutstanding]),
      low_stock_count: lowStock.filter(({ branch_id }) => branch_id === branch.id).length,
    };
  });
}

async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: DatabaseError }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += compatibilityPageSize) {
    const { data, error } = await fetchPage(from, from + compatibilityPageSize - 1);
    if (error) throw compatibilityLoadError(error);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < compatibilityPageSize) return rows;
  }
}

function branchDayWindow(timezone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
  return {
    start: zonedDateTimeToUtc(`${today}T00:00`, timezone)!,
    end: zonedDateTimeToUtc(`${tomorrow}T00:00`, timezone)!,
  };
}

function compatibilityLoadError(error: DatabaseError) {
  return new Error("Unable to load Command Center compatibility metrics.", { cause: error });
}
