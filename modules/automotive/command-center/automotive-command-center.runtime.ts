import "server-only";

import { createClient } from "@/lib/supabase/server";
import { zonedDateTimeToUtc } from "@/lib/operations";
import {
  composeCommandCenterSnapshot,
  type SharedCommandCenterSnapshot,
} from "@/modules/core/command-center";
import { assignmentContextLabel, loadAppointmentAssignmentContext } from "@/modules/core/scheduling/appointment-assignment-view";
import {
  automotiveActiveJobStatuses,
  deriveAutomotiveActions,
  deriveAutomotiveOperations,
  deriveAutomotiveStaff,
  type AutomotiveAppointmentCandidate,
  type AutomotiveInvoiceCandidate,
  type AutomotiveJobCandidate,
  type AutomotiveMaintenanceCandidate,
  type AutomotiveStaffCandidate,
} from "@/modules/automotive/command-center/automotive-command-center";

export type AutomotiveCommandCenterResult = {
  snapshot: SharedCommandCenterSnapshot;
  sectionErrors: Partial<Record<"actions" | "operations" | "staff", string>>;
};

export async function getAutomotiveCommandCenter(shared: SharedCommandCenterSnapshot): Promise<AutomotiveCommandCenterResult> {
  const supabase = await createClient();
  const windows = shared.branchPerformance.map(({ branchId, timezone }) => ({ branchId, ...todayWindow(timezone) }));
  const minStart = new Date(Math.min(...windows.map(({ start }) => start.valueOf()))).toISOString();
  const maxEnd = new Date(Math.max(...windows.map(({ end }) => end.valueOf()))).toISOString();
  // The aggregate RPC is the final branch-authorization boundary. Compose
  // vertical reads only from the branch rows it actually returned.
  const branchIds = shared.branchPerformance.map(({ branchId }) => branchId);

  const [jobsResult, appointmentsResult, invoicesResult, maintenanceResult, staffResult, sessionsResult] = await Promise.all([
    supabase.from("job_orders")
      .select("id,branch_id,appointment_id,job_number,status,created_at,started_at,promised_at,customers(full_name),vehicles(make,model,plate_number),job_order_items(service_name_snapshot)")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).in("status", [...automotiveActiveJobStatuses])
      .order("created_at", { ascending: true }).limit(250),
    supabase.from("appointments")
      .select("id,branch_id,starts_at,status,customers(full_name),vehicles(make,model,plate_number),appointment_services(service_name_snapshot)")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds)
      .gte("starts_at", minStart).lt("starts_at", maxEnd).order("starts_at").limit(250),
    supabase.from("invoices")
      .select("id,branch_id,job_order_id,created_at,balance_centavos,status,job_orders!inner(job_number,status,vehicles(make,model,plate_number))")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).neq("status", "void")
      .gt("balance_centavos", 0).eq("job_orders.status", "completed").order("created_at", { ascending: true }).limit(250),
    supabase.from("vehicle_maintenance_due")
      .select("id,branch_id,next_due_at,lifecycle_status,services(name),vehicles(make,model,plate_number)")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).eq("lifecycle_status", "active")
      .not("next_due_at", "is", null).lt("next_due_at", new Date().toISOString()).order("next_due_at").limit(250),
    supabase.from("staff_directory")
      .select("staff_id,full_name,job_function,branch_ids")
      .eq("organization_id", shared.scope.organizationId).eq("is_active", true)
      .order("full_name").limit(150),
    supabase.from("automotive_job_order_work_sessions")
      .select("id,branch_id,job_order_id,technician_staff_id,technician_name_snapshot,status")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).eq("status", "active").limit(150),
  ]);

  const jobs = ((jobsResult.data ?? []) as unknown as RawJob[]).map(mapJob);
  const jobIds = jobs.map(({ id }) => id);
  const estimatesResult = jobIds.length
    ? await supabase.from("estimates").select("id,job_order_id,branch_id,created_at,status")
      .eq("organization_id", shared.scope.organizationId).in("branch_id", branchIds).in("job_order_id", jobIds)
      .eq("status", "sent").order("created_at", { ascending: true }).limit(250)
    : { data: [], error: null };
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const estimates = (estimatesResult.data ?? []).flatMap((row) => {
    const job = jobById.get(row.job_order_id);
    return job ? [{ id: row.id, jobOrderId: row.job_order_id, branchId: row.branch_id, createdAt: row.created_at, jobNumber: job.jobNumber, vehicle: job.vehicle }] : [];
  });
  const invoices = ((invoicesResult.data ?? []) as unknown as RawInvoice[]).map(mapInvoice);
  const maintenance = ((maintenanceResult.data ?? []) as unknown as RawMaintenance[]).map(mapMaintenance);
  const appointmentRows = ((appointmentsResult.data ?? []) as unknown as RawAppointment[])
    .filter((appointment) => inBranchToday(appointment.branch_id, appointment.starts_at, windows));
  const assignmentContext = await loadAppointmentAssignmentContext(shared.scope.organizationId, appointmentRows.map(({ id }) => id));
  const appointments = appointmentRows.map((appointment): AutomotiveAppointmentCandidate => {
    const labels = assignmentContextLabel(assignmentContext.get(appointment.id) ?? { scheduledStaff: [], scheduledResources: [] });
    return {
      id: appointment.id,
      branchId: appointment.branch_id,
      startsAt: appointment.starts_at,
      status: appointment.status,
      vehicle: vehicleLabel(one(appointment.vehicles)),
      customer: one(appointment.customers)?.full_name ?? "Customer",
      serviceSummary: appointment.appointment_services.map(({ service_name_snapshot }) => service_name_snapshot).join(", ") || "Services not assigned",
      staffSummary: labels.staff,
      resourceSummary: labels.resources,
    };
  });
  const activeSessionByStaff = new Map(((sessionsResult.data ?? []) as unknown as RawWorkSession[]).map((session) => [session.technician_staff_id, session]));
  const staff = ((staffResult.data ?? []) as unknown as RawStaff[])
    .filter((member) => memberInScope(member.branch_ids, branchIds))
    .map((member): AutomotiveStaffCandidate => {
    const active = activeSessionByStaff.get(member.staff_id);
    const activeJob = active ? jobById.get(active.job_order_id) : undefined;
    const nextAppointment = appointments
      .filter((appointment) => assignmentContext.get(appointment.id)?.scheduledStaff.some(({ id }) => id === member.staff_id))
      .filter(({ startsAt }) => startsAt && Date.parse(startsAt) > Date.now())
      .sort((left, right) => Date.parse(left.startsAt!) - Date.parse(right.startsAt!))[0];
    return {
      id: member.staff_id,
      branchId: active?.branch_id ?? nextAppointment?.branchId,
      displayName: member.full_name,
      activeJobId: active?.job_order_id,
      activeJobLabel: activeJob ? `${activeJob.vehicle} · ${activeJob.jobNumber == null ? "Job Order" : `Job #${activeJob.jobNumber}`}` : undefined,
      nextAppointmentId: nextAppointment?.id,
      nextAppointmentAt: nextAppointment?.startsAt ?? undefined,
      nextAppointmentLabel: nextAppointment ? `${nextAppointment.vehicle} · ${nextAppointment.serviceSummary}` : undefined,
    };
  });
  const lowStockByBranch = new Map(shared.branchPerformance.map(({ branchId, lowStockCount }) => [branchId, lowStockCount]));
  const actions = deriveAutomotiveActions({ jobs, estimates, invoices, maintenance, lowStockByBranch });
  const snapshot = composeCommandCenterSnapshot(shared, {
    actions,
    operations: deriveAutomotiveOperations(appointments, jobs),
    staff: deriveAutomotiveStaff(staff),
  });

  return {
    snapshot,
    sectionErrors: {
      ...(jobsResult.error || estimatesResult.error || invoicesResult.error || maintenanceResult.error ? { actions: "Some Automotive action items could not be loaded." } : {}),
      ...(jobsResult.error || appointmentsResult.error ? { operations: "Some of today’s Automotive operations could not be loaded." } : {}),
      ...(staffResult.error || sessionsResult.error ? { staff: "Some technician availability could not be loaded." } : {}),
    },
  };
}

type RawJob = { id: string; branch_id: string; appointment_id: string | null; job_number: number | null; status: string; created_at: string; started_at: string | null; promised_at: string | null; customers: { full_name: string } | { full_name: string }[] | null; vehicles: Vehicle | Vehicle[] | null; job_order_items: Array<{ service_name_snapshot: string }> };
type RawAppointment = { id: string; branch_id: string; starts_at: string | null; status: string; customers: { full_name: string } | { full_name: string }[] | null; vehicles: Vehicle | Vehicle[] | null; appointment_services: Array<{ service_name_snapshot: string }> };
type RawInvoice = { id: string; branch_id: string; job_order_id: string; created_at: string; balance_centavos: number; job_orders: { job_number: number | null; vehicles: Vehicle | Vehicle[] | null } | Array<{ job_number: number | null; vehicles: Vehicle | Vehicle[] | null }> | null };
type RawMaintenance = { id: string; branch_id: string; next_due_at: string; services: { name: string } | { name: string }[] | null; vehicles: Vehicle | Vehicle[] | null };
type RawStaff = { staff_id: string; full_name: string; job_function: string | null; branch_ids: string[] };
type RawWorkSession = { branch_id: string; job_order_id: string; technician_staff_id: string };
type Vehicle = { make: string | null; model: string | null; plate_number: string | null };

function mapJob(row: RawJob): AutomotiveJobCandidate {
  return { id: row.id, branchId: row.branch_id, status: row.status, createdAt: row.created_at, startedAt: row.started_at, promisedAt: row.promised_at, appointmentId: row.appointment_id, jobNumber: row.job_number, vehicle: vehicleLabel(one(row.vehicles)), customer: one(row.customers)?.full_name ?? "Customer", serviceSummary: row.job_order_items.map(({ service_name_snapshot }) => service_name_snapshot).join(", ") || "Services not assigned" };
}

function mapInvoice(row: RawInvoice): AutomotiveInvoiceCandidate {
  const job = one(row.job_orders);
  return { id: row.id, jobOrderId: row.job_order_id, branchId: row.branch_id, createdAt: row.created_at, balanceCentavos: Number(row.balance_centavos), jobNumber: job?.job_number ?? null, vehicle: vehicleLabel(one(job?.vehicles ?? null)) };
}

function mapMaintenance(row: RawMaintenance): AutomotiveMaintenanceCandidate {
  return { id: row.id, branchId: row.branch_id, dueAt: row.next_due_at, serviceName: one(row.services)?.name ?? "Maintenance", vehicle: vehicleLabel(one(row.vehicles)) };
}

function vehicleLabel(vehicle: Vehicle | null) {
  return vehicle ? [vehicle.make, vehicle.model, vehicle.plate_number && `· ${vehicle.plate_number}`].filter(Boolean).join(" ") || "Vehicle" : "Vehicle";
}

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
