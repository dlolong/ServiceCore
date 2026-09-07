import Link from "next/link";
import { redirect } from "next/navigation";

import { CommandCenter, type CommandCenterQuickAction } from "@/components/command-center/command-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { zonedDateTimeToUtc } from "@/lib/operations";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import type { SharedCommandCenterSnapshot } from "@/modules/core/command-center";
import { getSharedCommandCenterSnapshot } from "@/modules/core/command-center/command-center.runtime";
import { assignmentContextLabel, loadAppointmentAssignmentContext } from "@/modules/core/scheduling/appointment-assignment-view";
import { verticalBrands } from "@/modules/platform/brand";

type DashboardQuery = { branch?: string; error?: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const [query, context] = await Promise.all([searchParams, getDashboardContext()]);
  const { activeMembership, profile } = context;
  const isCommandCenterRole = activeMembership.role === "owner" || activeMembership.role === "manager";
  if (!isCommandCenterRole) {
    if (activeMembership.industry === "automotive" && activeMembership.role === "technician") redirect("/dashboard/my-work");
    return <StaffOperationalDashboard query={query} context={context}/>;
  }

  let loaded: VerticalCommandCenterResult | null = null;
  try {
    const shared = await getSharedCommandCenterSnapshot(query.branch);
    loaded = await loadVerticalCommandCenter(activeMembership.industry, shared);
  } catch {
    loaded = null;
  }
  if (!loaded) return <main id="negosu-command-center-page" className="mx-auto max-w-4xl"><Card id="negosu-command-center-error" className="p-6 text-center"><h1 className="text-xl font-semibold text-admin-text">Unable to load Command Center</h1><p className="mt-2 text-sm text-slate-600">Your dashboard data could not be loaded safely. Refresh the page or return to the current branch view.</p><div className="mt-4 flex justify-center gap-2"><Button asChild><Link href="/dashboard">Current branch</Link></Button><Button asChild variant="secondary"><Link href="/dashboard/settings">Settings</Link></Button></div></Card></main>;
  const salon = activeMembership.industry === "salon";
  return <CommandCenter
    snapshot={loaded.snapshot}
    organizationName={activeMembership.organizationName}
    firstName={firstName(profile.fullName)}
    branches={activeMembership.branches}
    verticalLabel={salon ? verticalBrands.salon.displayName : verticalBrands.automotive.displayName}
    todayTitle={salon ? "Today’s Appointments" : "Today’s Automotive Operations"}
    todayDescription={salon ? "Clients, Treatments, assigned Staff, and visit status." : "Scheduled vehicles and active Job Orders."}
    todayVerticalId={salon ? "salon-command-center-today-appointments" : "automotive-command-center-jobs"}
    actionVerticalId={salon ? undefined : "automotive-command-center-estimates"}
    staffDescription={salon ? "Current and next assigned Client visits." : "Active technician work and next scheduled assignments."}
    quickActions={quickActions(activeMembership.industry, activeMembership.role, loaded.snapshot.scope.mode)}
    sectionErrors={loaded.sectionErrors}
  />;
}

type VerticalCommandCenterResult = {
  snapshot: SharedCommandCenterSnapshot;
  sectionErrors: Partial<Record<"actions" | "operations" | "staff", string>>;
};

async function loadVerticalCommandCenter(industry: string, shared: SharedCommandCenterSnapshot): Promise<VerticalCommandCenterResult> {
  if (industry === "salon") {
    const { getSalonCommandCenter } = await import("@/modules/salon/command-center/salon-command-center.runtime");
    return getSalonCommandCenter(shared);
  }
  const { getAutomotiveCommandCenter } = await import("@/modules/automotive/command-center/automotive-command-center.runtime");
  return getAutomotiveCommandCenter(shared);
}

async function StaffOperationalDashboard({ query, context }: { query: DashboardQuery; context: Awaited<ReturnType<typeof getDashboardContext>> }) {
  const { activeMembership, profile } = context;
  const salon = activeMembership.industry === "salon";
  const supabase = await createClient();
  const { start, end } = todayWindow(activeMembership.timezone);
  const projection = salon
    ? "id,starts_at,status,customers(full_name),appointment_services(service_name_snapshot)"
    : "id,starts_at,status,customers(full_name),vehicles(make,model,plate_number),appointment_services(service_name_snapshot)";
  const { data, error } = await supabase.from("appointments").select(projection)
    .eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId)
    .gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString()).order("starts_at").limit(10);
  const appointments = (data ?? []) as unknown as StaffAppointment[];
  const assignments = await loadAppointmentAssignmentContext(activeMembership.organizationId, appointments.map(({ id }) => id));
  const canCreate = roleHasPermission(activeMembership.role, "appointments.manage");

  return <main id="negosu-staff-dashboard-page" className="mx-auto max-w-6xl pb-5">
    {query.error ? <div id="negosu-staff-dashboard-message" role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error}</div> : null}
    <header id="negosu-staff-dashboard-header" className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-admin-border bg-admin-surface px-4 py-4 shadow-sm"><div><Badge>{activeMembership.branchName}</Badge><h1 className="mt-2 text-2xl font-semibold text-admin-text">Welcome, {firstName(profile.fullName)}.</h1><p className="mt-1 text-sm text-slate-500">Your operational view for today.</p></div>{canCreate ? <Button asChild><Link id="negosu-staff-dashboard-new-appointment" href="/dashboard/appointments/new">New Appointment</Link></Button> : null}</header>
    <section id="negosu-staff-dashboard-today" className="mt-3 rounded-2xl border border-admin-border bg-admin-surface p-4 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="font-semibold text-admin-text">Today&apos;s Appointments</h2><p className="text-xs text-slate-500">A compact branch schedule with no financial or organization-wide metrics.</p></div><Link className="text-sm font-bold text-brand-primary-strong" href="/dashboard/appointments">View all</Link></div>
      {error ? <p id="negosu-staff-dashboard-error" role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Unable to load today&apos;s appointments.</p> : null}
      <div className="mt-3 divide-y divide-slate-100">{appointments.map((appointment) => {
        const customer = one(appointment.customers);
        const vehicle = one(appointment.vehicles ?? null);
        const subject = salon ? customer?.full_name ?? "Client" : vehicleLabel(vehicle);
        const services = appointment.appointment_services.map(({ service_name_snapshot }) => service_name_snapshot).join(", ") || (salon ? "Treatment not assigned" : "Services not assigned");
        const labels = assignmentContextLabel(assignments.get(appointment.id) ?? { scheduledStaff: [], scheduledResources: [] });
        return <Link id={`negosu-staff-dashboard-appointment-${appointment.id}`} href={`/dashboard/appointments/${appointment.id}`} key={appointment.id} className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-3 hover:bg-slate-50"><strong className="text-sm text-brand-primary-strong">{formatTime(appointment.starts_at, activeMembership.timezone)}</strong><span className="min-w-0"><strong className="block truncate text-sm text-admin-text">{subject}</strong><span className="block truncate text-xs text-slate-500">{services} · {labels.staff}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-700">{appointment.status.replaceAll("_", " ")}</span></Link>;
      })}</div>
      {!appointments.length && !error ? <p id="negosu-staff-dashboard-empty" className="py-8 text-center text-sm text-slate-500">No Appointments are scheduled for this branch today.</p> : null}
    </section>
  </main>;
}

function quickActions(industry: string, role: Parameters<typeof roleHasPermission>[0], scopeMode: "branch" | "all"): CommandCenterQuickAction[] {
  const candidates = industry === "salon" ? [
    { id: "new-appointment", label: "New Appointment", description: "Book a Client visit", href: "/dashboard/appointments/new", permission: "appointments.manage" as const },
    { id: "add-client", label: "Add Client", description: "Create a Client record", href: "/dashboard/customers/new", permission: "customers.write" as const },
    { id: "add-treatment", label: "Add Treatment", description: "Configure a Treatment", href: "/dashboard/services/new", permission: "services.manage" as const },
    { id: "manage-staff", label: "Manage Staff", description: "Staff access and job functions", href: "/dashboard/settings/staff", permission: "staff.manage" as const },
  ] : [
    { id: "new-appointment", label: "New Appointment", description: "Schedule a vehicle visit", href: "/dashboard/appointments/new", permission: "appointments.manage" as const },
    { id: "add-walk-in", label: "Add Walk-In", description: "Start a branch arrival", href: "/dashboard/queue/new", permission: "appointments.manage" as const },
    { id: "add-customer", label: "Add Customer", description: "Create a Customer record", href: "/dashboard/customers/new", permission: "customers.write" as const },
    { id: "add-vehicle", label: "Add Vehicle", description: "Register a Customer vehicle", href: "/dashboard/vehicles/new", permission: "vehicles.write" as const },
    { id: "inventory", label: "Inventory", description: "Review stock and movements", href: "/dashboard/inventory", permission: "inventory.manage" as const },
  ];
  if (scopeMode === "all") return [];
  return candidates.filter(({ permission }) => roleHasPermission(role, permission)).map(({ id, label, description, href }) => ({ id, label, description, href }));
}

type StaffAppointment = { id: string; starts_at: string | null; status: string; customers: { full_name: string } | { full_name: string }[] | null; vehicles?: Vehicle | Vehicle[] | null; appointment_services: Array<{ service_name_snapshot: string }> };
type Vehicle = { make: string | null; model: string | null; plate_number: string | null };

function todayWindow(timeZone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return { start: zonedDateTimeToUtc(`${today}T00:00`, timeZone)!, end: zonedDateTimeToUtc(`${nextDay}T00:00`, timeZone)! };
}

function firstName(value: string) { return value.trim().split(/\s+/)[0] || "there"; }
function formatTime(value: string | null, timeZone: string) { return value ? new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Any time"; }
function vehicleLabel(vehicle: Vehicle | null) { return vehicle ? [vehicle.make, vehicle.model, vehicle.plate_number && `· ${vehicle.plate_number}`].filter(Boolean).join(" ") || "Vehicle" : "Vehicle"; }
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
