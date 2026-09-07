import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarDays, ChevronRight, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SharedCommandCenterSnapshot } from "@/modules/core/command-center";

export type CommandCenterQuickAction = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export function CommandCenter({
  snapshot,
  organizationName,
  firstName,
  branches,
  verticalLabel,
  todayTitle,
  todayDescription,
  todayVerticalId,
  actionVerticalId,
  staffDescription,
  quickActions,
  sectionErrors = {},
}: {
  snapshot: SharedCommandCenterSnapshot;
  organizationName: string;
  firstName: string;
  branches: ReadonlyArray<{ id: string; name: string }>;
  verticalLabel: string;
  todayTitle: string;
  todayDescription: string;
  todayVerticalId: string;
  actionVerticalId?: string;
  staffDescription: string;
  quickActions: readonly CommandCenterQuickAction[];
  sectionErrors?: Partial<Record<"actions" | "operations" | "staff", string>>;
}) {
  const branchNames = new Map(branches.map(({ id, name }) => [id, name]));
  const attentionCount = snapshot.metrics.find(({ key }) => key === "attention")?.value ?? snapshot.actions.length;
  return <main id="negosu-command-center-page" className="mx-auto min-w-0 max-w-7xl pb-5">
    <header id="negosu-command-center-header" className="flex flex-wrap items-end justify-between gap-3 border-b border-admin-border pb-4">
      <div className="min-w-0"><p className="text-xs font-semibold tracking-[0.12em] text-brand-primary">{verticalLabel}</p><h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-admin-text sm:text-3xl">Command Center</h1><p id="negosu-command-center-operational-date" className="mt-0.5 text-xs font-semibold text-slate-500">{operationalDate(snapshot)} · {snapshot.scope.label}</p><p className="mt-0.5 text-sm text-slate-600">Good day, {firstName}. Here&apos;s what needs attention at {organizationName}.</p></div>
      <form id="negosu-command-center-branch-selector-form" action="/dashboard/branch-context" className="flex w-full items-end gap-2 sm:w-auto" method="get"><input type="hidden" name="next" value="/dashboard"/>
        <label className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-slate-500 sm:min-w-48">View
          <select id="negosu-command-center-branch-selector" name="branch" defaultValue={snapshot.scope.mode === "all" ? "all" : snapshot.scope.selectedBranchId ?? ""} className="mt-1 min-h-10 w-full rounded-xl border border-admin-border bg-white px-3 text-sm font-semibold normal-case text-admin-text">
            {branches.length > 1 ? <option value="all">All Branches</option> : null}
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <Button id="negosu-command-center-branch-apply" type="submit" size="sm" variant="secondary">Apply</Button>
      </form>
    </header>

    <section id="negosu-command-center-metrics" aria-label="Business metrics" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
      {snapshot.metrics.map((metric) => {
        const content = <><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">{metric.label}</span><strong className="mt-1 block text-xl font-semibold tracking-tight text-admin-text sm:text-2xl">{metric.valueKind === "currency" ? formatCurrency(metric.value, snapshot.scope.currency) : metric.value.toLocaleString("en-PH")}</strong>{metric.helperText ? <small className="mt-0.5 hidden text-xs text-slate-500 sm:block">{metric.helperText}</small> : null}</>;
        const id = metricId(metric.key);
        return metric.href && snapshot.scope.mode !== "all"
          ? <Link id={id} key={metric.key} href={metric.href} className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-3 transition-colors hover:border-brand-border hover:bg-brand-tint/40 sm:p-4">{content}</Link>
          : <Card id={id} key={metric.key} elevation="none" className="min-w-0 rounded-xl p-3 sm:p-4">{content}</Card>;
      })}
    </section>

    <div className="mt-3 grid min-w-0 gap-3 xl:grid-cols-[1.05fr_0.95fr]">
      <section id="negosu-action-inbox" aria-labelledby="negosu-action-inbox-title" className="min-w-0 rounded-xl border border-admin-border border-l-4 border-l-brand-primary bg-admin-surface p-4">
        <div className="flex items-start justify-between gap-3"><div><h2 id="negosu-action-inbox-title" className="font-semibold text-admin-text">Action Inbox</h2><p className="text-xs text-slate-500">Live conditions disappear when the underlying work is resolved.</p></div><Badge>{attentionCount} {attentionCount === 1 ? "condition" : "conditions"}</Badge></div>
        {sectionErrors.actions ? <SectionError id="negosu-action-inbox-error" message={sectionErrors.actions}/> : null}
        <div id={actionVerticalId} className="mt-3 divide-y divide-slate-100">{snapshot.actions.slice(0, 8).map((action) => <Link id={`negosu-action-item-${action.id}`} key={action.id} href={action.href} className="group flex min-w-0 items-start gap-3 px-1 py-3 transition-colors hover:bg-blue-50/50">
          <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityColor(action.priority)}`}/><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm text-admin-text">{action.title}</strong><small className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">{action.priority}</small></span>{action.description ? <span className="mt-0.5 block truncate text-xs text-slate-500">{action.description}{snapshot.scope.mode === "all" && action.branchId ? ` · ${branchNames.get(action.branchId) ?? "Branch"}` : ""}</span> : null}</span><ChevronRight aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400 group-hover:text-brand-primary" size={17}/>
        </Link>)}</div>
        {!snapshot.actions.length && !sectionErrors.actions ? <div id="negosu-action-inbox-empty" className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center"><strong className="text-sm text-admin-text">You&apos;re caught up</strong><p className="mt-0.5 text-xs text-slate-500">No current conditions need management attention.</p></div> : null}
      </section>

      <section id="negosu-today-operations" aria-labelledby="negosu-today-operations-title" className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4">
        <div className="flex items-start justify-between gap-3"><div><h2 id="negosu-today-operations-title" className="font-semibold text-admin-text">{todayTitle}</h2><p className="text-xs text-slate-500">{todayDescription}</p></div><CalendarDays aria-hidden="true" className="text-brand-primary" size={19}/></div>
        {sectionErrors.operations ? <SectionError id="negosu-today-operations-error" message={sectionErrors.operations}/> : null}
        <div id={todayVerticalId} className="mt-3 grid gap-1">{snapshot.operations.slice(0, 10).map((operation) => <Link id={`negosu-operation-${operation.id}`} key={operation.id} href={operation.href} className="grid min-w-0 grid-cols-[4.4rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50">
          <span className="text-xs font-semibold text-brand-primary-strong">{formatTime(operation.startsAt, branchTimezone(operation.branchId, snapshot))}</span><span className="min-w-0"><strong className="block truncate text-sm text-admin-text">{operation.title}</strong><span className="block truncate text-xs text-slate-500">{operation.subject}{operation.staffSummary ? ` · ${operation.staffSummary}` : ""}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold capitalize text-slate-700">{operation.status.replaceAll("_", " ")}</span>
        </Link>)}</div>
        {!snapshot.operations.length && !sectionErrors.operations ? <div id="negosu-today-operations-empty" className="mt-3 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">Nothing is scheduled or active in this view today.</div> : null}
      </section>
    </div>

    <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[1fr_1fr]">
      <section id="negosu-command-center-quick-actions" className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4"><h2 className="font-semibold text-admin-text">Quick Actions</h2>{quickActions.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{quickActions.map((action) => <Link id={`negosu-command-center-quick-action-${action.id}`} key={action.id} href={action.href} className="group min-w-0 rounded-xl border border-slate-200 p-3 hover:border-brand-border hover:bg-blue-50/50"><strong className="block text-sm text-admin-text">{action.label}</strong><span className="mt-0.5 hidden text-xs text-slate-500 sm:block">{action.description}</span><ArrowRight aria-hidden="true" className="mt-2 text-brand-primary transition-transform group-hover:translate-x-0.5" size={16}/></Link>)}</div> : <p id="negosu-command-center-quick-actions-branch-guidance" className="mt-3 rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-600">Select a branch before starting operational work.</p>}</section>
      <section id="negosu-staff-snapshot" className="min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-admin-text">Staff Snapshot</h2><p className="text-xs text-slate-500">{staffDescription}</p></div><UsersRound aria-hidden="true" className="text-brand-primary" size={19}/></div>
        {sectionErrors.staff ? <SectionError id="negosu-staff-snapshot-error" message={sectionErrors.staff}/> : null}
        <div className="mt-3 grid gap-1 sm:grid-cols-2">{snapshot.staff.slice(0, 10).map((staff) => {
          const content = <><span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${staffColor(staff.status)}`}/><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm text-admin-text">{staff.displayName}</strong><small className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">{staff.status}</small></span><span className="block truncate text-xs text-slate-500">{staff.context ?? capitalize(staff.status)}{staff.nextAt ? ` · ${formatTime(staff.nextAt, branchTimezone(staff.branchId, snapshot))}` : ""}</span></span></>;
          return staff.href ? <Link id={`negosu-staff-item-${staff.id}`} key={staff.id} href={staff.href} className="flex min-w-0 gap-2 rounded-xl px-2 py-2 hover:bg-slate-50">{content}</Link> : <div id={`negosu-staff-item-${staff.id}`} key={staff.id} className="flex min-w-0 gap-2 rounded-xl px-2 py-2">{content}</div>;
        })}</div>{!snapshot.staff.length && !sectionErrors.staff ? <p id="negosu-staff-snapshot-empty" className="mt-3 rounded-xl bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">No active Staff are available in this view.</p> : null}
      </section>
    </div>

    {snapshot.scope.mode === "all" && snapshot.branchPerformance.length > 1 ? <section id="negosu-branch-performance" className="mt-3 min-w-0 rounded-xl border border-admin-border bg-admin-surface p-4"><h2 className="font-semibold text-admin-text">Branch Performance</h2><div className="mt-3 hidden overflow-hidden rounded-xl border border-slate-200 md:block"><table id="negosu-branch-performance-table" className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Branch</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Appointments</th><th className="px-3 py-2 text-right">Outstanding</th><th className="px-3 py-2 text-right">Attention</th></tr></thead><tbody className="divide-y">{snapshot.branchPerformance.map((branch) => <tr id={`negosu-branch-performance-${branch.branchId}`} key={branch.branchId}><th className="px-3 py-2.5">{branch.branchName}</th><td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(branch.revenueTodayCentavos, snapshot.scope.currency)}</td><td className="px-3 py-2.5 text-right">{branch.appointmentsToday}</td><td className="px-3 py-2.5 text-right">{formatCurrency(branch.outstandingCentavos, snapshot.scope.currency)}</td><td className="px-3 py-2.5 text-right font-bold">{branch.attentionCount}</td></tr>)}</tbody></table></div><div id="negosu-branch-performance-mobile" className="mt-3 grid gap-2 md:hidden">{snapshot.branchPerformance.map((branch) => <article id={`negosu-branch-performance-card-${branch.branchId}`} key={branch.branchId} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><strong>{branch.branchName}</strong><Badge>{branch.attentionCount} attention</Badge></div><dl className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-slate-500">Revenue</dt><dd className="font-bold">{formatCurrency(branch.revenueTodayCentavos, snapshot.scope.currency)}</dd></div><div><dt className="text-slate-500">Appointments</dt><dd className="font-bold">{branch.appointmentsToday}</dd></div><div><dt className="text-slate-500">Outstanding</dt><dd className="font-bold">{formatCurrency(branch.outstandingCentavos, snapshot.scope.currency)}</dd></div></dl></article>)}</div></section> : null}
  </main>;
}

function SectionError({ id, message }: { id: string; message: string }) {
  return <div id={id} role="alert" className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertCircle aria-hidden="true" className="shrink-0" size={16}/><span>{message} Refresh to try again.</span></div>;
}

function metricId(key: string) {
  return ({ revenue_today: "negosu-command-center-revenue", appointments_today: "negosu-command-center-appointments", outstanding: "negosu-command-center-outstanding", low_stock: "negosu-command-center-low-stock", attention: "negosu-command-center-attention-count" } as Record<string, string>)[key] ?? `negosu-command-center-metric-${key.replace(/[^a-z0-9-]/g, "-")}`;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value / 100);
}

function formatTime(value: string | null | undefined, timeZone?: string) {
  if (!value) return "Any time";
  return new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function branchTimezone(branchId: string | undefined, snapshot: SharedCommandCenterSnapshot) {
  return snapshot.branchPerformance.find((branch) => branch.branchId === branchId)?.timezone;
}

function operationalDate(snapshot: SharedCommandCenterSnapshot) {
  if (snapshot.scope.mode === "all") return "Today · each branch’s local date";
  const selectedTimezone = snapshot.scope.selectedBranchId
    ? snapshot.branchPerformance.find(({ branchId }) => branchId === snapshot.scope.selectedBranchId)?.timezone
    : undefined;
  return new Intl.DateTimeFormat("en-PH", { timeZone: selectedTimezone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function priorityColor(priority: string) {
  return priority === "critical" ? "bg-red-600" : priority === "high" ? "bg-amber-500" : priority === "medium" ? "bg-blue-500" : "bg-slate-400";
}

function staffColor(status: string) {
  return status === "working" || status === "busy" ? "bg-amber-500" : status === "available" ? "bg-emerald-500" : "bg-slate-400";
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
