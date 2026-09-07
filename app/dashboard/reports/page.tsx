import Link from "next/link";
import type { ReactNode } from "react";

import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { getDashboardContext } from "@/lib/auth/context";
import { formatMoney } from "@/lib/operations";
import { reportQuerySchema, resolveReportRange, type OwnerReport } from "@/lib/reporting";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

const inputClass = "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm";
const reportSections = ["overview", "revenue", "team", "branches"] as const;
type ReportSection = (typeof reportSections)[number];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [raw, { activeMembership }, supabase] = await Promise.all([
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);

  if (!roleHasPermission(activeMembership.role, "reports.view")) {
    return <ReportState title="Reports are not available" description="You do not have reporting access." />;
  }

  const parsed = reportQuerySchema.safeParse(
    Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])),
  );
  const filters = parsed.success ? parsed.data : reportQuerySchema.parse({});
  const branch = filters.branch === "all" || activeMembership.branches.some(({ id }) => id === filters.branch)
    ? filters.branch
    : "all";
  const range = resolveReportRange({ ...filters, branch }, activeMembership.timezone);
  const requestedSection = typeof raw.section === "string" ? raw.section : "overview";
  const candidateSection: ReportSection = reportSections.includes(requestedSection as ReportSection)
    ? requestedSection as ReportSection
    : "overview";
  const section: ReportSection = candidateSection === "branches" && branch !== "all" ? "overview" : candidateSection;

  const { data: reportAccess } = await supabase.rpc("get_org_entitlements", {
    p_organization_id: activeMembership.organizationId,
  });
  if (!(reportAccess as { features?: { advanced_reports?: boolean } } | null)?.features?.advanced_reports) {
    return (
      <ReportState title="Advanced reports require an eligible plan" description="Review available plans and choose the reporting access that fits your business.">
        <Button id="reports-view-plans-button" asChild className="mt-4">
          <Link href="/dashboard/settings/billing">View plans</Link>
        </Button>
      </ReportState>
    );
  }

  const { data, error } = await supabase.rpc("get_owner_report", {
    p_organization_id: activeMembership.organizationId,
    p_start_date: range.start,
    p_end_date: range.end,
    p_branch_id: branch === "all" ? null : branch,
  });
  const report = data as OwnerReport | null;
  if (error || !report) {
    return <ReportState title="Could not load reports" description="Try loading this page again. No business data was changed." retry />;
  }

  const { data: revenue } = await supabase.rpc("get_invoice_revenue_breakdown", {
    p_organization_id: activeMembership.organizationId,
    p_start_date: range.start,
    p_end_date: range.end,
    p_branch_id: branch === "all" ? null : branch,
  });
  if (revenue) {
    report.services = (revenue as Pick<OwnerReport, "services" | "categories">).services;
    report.categories = (revenue as Pick<OwnerReport, "services" | "categories">).categories;
  }

  const repeatRate = report.summary.customersServed
    ? Math.round(report.summary.repeatCustomers * 100 / report.summary.customersServed)
    : 0;
  const queryFor = (nextSection: ReportSection) => new URLSearchParams({
    preset: filters.preset,
    start: range.start,
    end: range.end,
    branch,
    section: nextSection,
  }).toString();
  const exportQuery = new URLSearchParams({
    preset: filters.preset,
    start: range.start,
    end: range.end,
    branch,
  }).toString();

  const tabs = [
    { id: "reports-tab-overview", label: "Overview", href: `/dashboard/reports?${queryFor("overview")}`, active: section === "overview" },
    { id: "reports-tab-revenue", label: "Revenue", href: `/dashboard/reports?${queryFor("revenue")}`, active: section === "revenue" },
    { id: "reports-tab-team", label: "Team", href: `/dashboard/reports?${queryFor("team")}`, active: section === "team" },
    ...(branch === "all" ? [{ id: "reports-tab-branches", label: "Branches", href: `/dashboard/reports?${queryFor("branches")}`, active: section === "branches" }] : []),
  ];

  return (
    <main id="reports-page" className="mx-auto w-full max-w-7xl">
      <header id="reports-page-header" className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-primary">Owner analytics</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Reports</h1>
          <p className="mt-2 text-sm text-zinc-600 sm:text-base">Revenue, customers, workload, and branch trends from operational records.</p>
        </div>
        <Button id="reports-export-button" asChild variant="secondary">
          <Link href={`/dashboard/reports/export?${exportQuery}`}>Export CSV</Link>
        </Button>
      </header>

      <form id="reports-filter-form" className="mt-5 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
        <input type="hidden" name="section" value={section} />
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-period-select">
          Period
          <select id="reports-period-select" className={inputClass} name="preset" defaultValue={filters.preset}>
            <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="custom">Custom</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-start-date-input">From<input id="reports-start-date-input" className={inputClass} type="date" name="start" defaultValue={range.start} /></label>
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-end-date-input">To<input id="reports-end-date-input" className={inputClass} type="date" name="end" defaultValue={range.end} /></label>
        <label className="grid gap-1 text-xs font-medium" htmlFor="reports-branch-select">
          Branch
          <select id="reports-branch-select" className={inputClass} name="branch" defaultValue={branch}>
            <option value="all">All accessible branches</option>
            {activeMembership.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <Button id="reports-apply-filters-button" type="submit">Apply</Button>
      </form>
      <p className="mt-2 text-xs text-zinc-500">{range.start} to {range.end} · local calendar dates per branch timezone</p>

      <section id="reports-summary" aria-label="Report summary" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Gross sales" value={formatMoney(report.summary.grossSalesCentavos)} />
        <StatCard label="Payments received" value={formatMoney(report.summary.paymentsReceivedCentavos)} />
        <StatCard label="Outstanding" value={formatMoney(report.summary.outstandingCentavos)} />
        <StatCard label="Completed jobs" value={String(report.summary.jobsCompleted)} />
        <StatCard label="Average ticket" value={formatMoney(report.summary.averageTicketCentavos)} />
      </section>

      <Tabs id="reports-section-tabs" ariaLabel="Report sections" className="mt-5" items={tabs} />

      {section === "overview" ? (
        <section id="reports-overview-section" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card id="reports-daily-totals" className="overflow-hidden p-0">
            <div className="border-b border-zinc-100 p-4"><h2 className="font-semibold">Daily totals</h2></div>
            {report.daily.length ? <>
              <table id="reports-daily-table" className="hidden w-full text-left text-sm sm:table">
                <thead className="bg-zinc-50 text-zinc-500"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Gross sales</th><th className="px-4 py-2 font-medium">Received</th><th className="px-4 py-2 font-medium">Jobs</th></tr></thead>
                <tbody>{report.daily.map((row) => <tr className="border-t" key={row.day}><td className="px-4 py-2.5">{row.day}</td><td className="px-4 py-2.5">{formatMoney(row.grossSalesCentavos)}</td><td className="px-4 py-2.5">{formatMoney(row.paymentsReceivedCentavos)}</td><td className="px-4 py-2.5">{row.jobsCompleted}</td></tr>)}</tbody>
              </table>
              <div id="reports-daily-mobile-list" className="divide-y sm:hidden">{report.daily.map((row) => <article className="p-4" key={row.day}><div className="flex justify-between gap-3"><span>{row.day}</span><span>{row.jobsCompleted} jobs</span></div><p className="mt-1 text-sm text-zinc-600">{formatMoney(row.grossSalesCentavos)} gross · {formatMoney(row.paymentsReceivedCentavos)} received</p></article>)}</div>
            </> : <p className="p-5 text-sm text-zinc-500">No activity in this period.</p>}
          </Card>
          <Card id="reports-customer-summary" className="p-4">
            <h2 className="font-semibold">Customers</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatCard label="Served" value={String(report.summary.customersServed)} />
              <StatCard label="Repeat rate" value={`${repeatRate}%`} note={`${report.summary.repeatCustomers} repeat customers`} />
              <StatCard label="New" value={String(report.summary.newCustomers)} />
              <StatCard label="Returning" value={String(Math.max(0, report.summary.customersServed - report.summary.newCustomers))} />
            </div>
          </Card>
        </section>
      ) : null}

      {section === "revenue" ? <section id="reports-revenue-section" className="mt-4 grid gap-4 lg:grid-cols-2"><ReportList id="reports-service-revenue" title="Service revenue" rows={report.services.map((row) => [row.service, `${formatMoney(row.revenueCentavos)} · ${row.quantity}`])} /><ReportList id="reports-category-revenue" title="Category revenue" rows={report.categories.map((row) => [row.category, formatMoney(row.revenueCentavos)])} /></section> : null}
      {section === "team" ? <section id="reports-team-section" className="mt-4"><ReportList id="reports-technician-workload" title="Technician workload" rows={report.technicians.map((row) => [row.name, `${row.completedJobs}/${row.assignedJobs} completed`])} /></section> : null}
      {section === "branches" && branch === "all" ? <BranchComparison rows={report.branches} /> : null}
    </main>
  );
}

function ReportState({ title, description, retry, children }: { title: string; description: string; retry?: boolean; children?: ReactNode }) {
  return <main id="reports-page" className="mx-auto w-full max-w-5xl"><header id="reports-page-header"><h1 className="text-2xl font-semibold sm:text-3xl">Reports</h1></header><Card id="reports-state" className="mt-5 p-6 text-center"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-zinc-600">{description}</p>{retry ? <Button id="reports-retry-button" asChild className="mt-4" variant="secondary"><Link href="/dashboard/reports">Try again</Link></Button> : null}{children}</Card></main>;
}

function ReportList({ id, title, rows }: { id: string; title: string; rows: Array<[string, string]> }) {
  return <Card id={id} className="p-4"><h2 className="font-semibold">{title}</h2><div className="mt-3 divide-y">{rows.map(([label, value], index) => <div className="flex justify-between gap-3 py-2.5 text-sm" key={`${label}-${index}`}><span>{label}</span><span className="text-right font-medium">{value}</span></div>)}{!rows.length ? <p className="py-4 text-sm text-zinc-500">No data in this period.</p> : null}</div></Card>;
}

function BranchComparison({ rows }: { rows: OwnerReport["branches"] }) {
  return <Card id="reports-branch-comparison" className="mt-4 p-4"><h2 className="font-semibold">Branch comparison</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{rows.map((row) => <article id={`reports-branch-${row.id}`} className="flex justify-between gap-3 rounded-xl border p-3" key={row.id}><span>{row.name}</span><span className="text-right"><span className="block font-medium">{formatMoney(row.grossSalesCentavos)}</span><small className="text-zinc-500">{row.invoices} invoices</small></span></article>)}{!rows.length ? <p className="text-sm text-zinc-500">No branch activity in this period.</p> : null}</div></Card>;
}
