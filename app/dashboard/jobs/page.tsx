import Link from "next/link";
import { Search } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { EmptyState, FilterBar, PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { getDashboardContext } from "@/lib/auth/context";
import { jobNumber } from "@/lib/jobs";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { isMissingCanonicalAutomotiveStaffColumn, type DatabaseError } from "@/lib/supabase/schema-compatibility";

export default async function JobsPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;message?:string;error?:string}>}) {
  const[p,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const { rows: loadedRows, error } = await loadJobDirectory(supabase, activeMembership.organizationId, activeMembership.branchId, p.status);
  const q=p.q?.trim().toLowerCase(),rows=loadedRows.filter(row=>!q||JSON.stringify(row).toLowerCase().includes(q));
  return <main id="job-orders-page" className="mx-auto max-w-7xl">
    <PageHeader id="job-orders-page-header" eyebrow={activeMembership.branchName} title="Job Orders" description="Live service-bay work, inspections, approvals, and release."/>
    <FormMessage {...p} error={p.error??(error?"Unable to load jobs.":undefined)}/>
    <FilterBar id="job-orders-filter-bar"><form id="job-orders-filter-form" className="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_13rem_auto]"><label className="relative"><span className="sr-only">Search job orders</span><Search className="absolute left-3 top-3.5 text-zinc-400" size={18}/><input id="job-orders-search-input" className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3" name="q" defaultValue={p.q} placeholder="Job number, customer, plate, or service"/></label><select id="job-orders-status-filter" className="min-h-11 rounded-xl border border-zinc-200 bg-white px-3 capitalize" name="status" defaultValue={p.status??""}><option value="">All statuses</option>{["queued","in_progress","on_hold","quality_check","ready_for_release","completed","cancelled"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select><Button type="submit" variant="secondary">Filter</Button></form></FilterBar>
    {rows.length?<><div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm md:block"><table id="job-orders-table" className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-4 py-3">Job</th><th className="px-4 py-3">Vehicle / customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Technician</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-zinc-100">{rows.map(row=>{const c=Array.isArray(row.customers)?row.customers[0]:row.customers,v=Array.isArray(row.vehicles)?row.vehicles[0]:row.vehicles;return <tr id={`job-order-row-${row.id}`} key={row.id} className="hover:bg-blue-50/80"><td className="px-4 py-3 font-semibold">{jobNumber(row.job_number??0,new Date(row.created_at).getFullYear())}<span className="block text-xs font-normal text-zinc-500">{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium"}).format(new Date(row.created_at))}</span></td><td className="px-4 py-3"><strong>{v?.make} {v?.model}{v?.plate_number?` · ${v.plate_number}`:""}</strong><span className="block text-xs text-zinc-500">{c?.full_name}</span></td><td className="px-4 py-3 font-semibold capitalize">{row.status.replaceAll("_"," ")}</td><td className="px-4 py-3 text-zinc-600">{row.technicianAssigned?"Assigned":"Unassigned"}</td><td className="px-4 py-3 text-right"><strong>{formatMoney(row.actual_total_centavos)}</strong></td><td className="px-4 py-3 text-right"><Button asChild size="sm" variant="secondary"><Link href={`/dashboard/jobs/${row.id}`}>Open</Link></Button></td></tr>})}</tbody></table></div>
      <div id="job-orders-mobile-list" className="mt-4 grid gap-2 md:hidden">{rows.map(row=>{const c=Array.isArray(row.customers)?row.customers[0]:row.customers,v=Array.isArray(row.vehicles)?row.vehicles[0]:row.vehicles;return <Link id={`job-order-card-${row.id}`} href={`/dashboard/jobs/${row.id}`} key={row.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><div className="flex justify-between gap-3"><strong>{jobNumber(row.job_number??0,new Date(row.created_at).getFullYear())}</strong><span className="text-xs font-bold capitalize">{row.status.replaceAll("_"," ")}</span></div><h2 className="mt-2 font-semibold">{v?.make} {v?.model}{v?.plate_number?` · ${v.plate_number}`:""}</h2><p className="text-sm text-zinc-600">{c?.full_name}</p><div className="mt-3 flex justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500"><span>{row.technicianAssigned?"Technician assigned":"Unassigned"}</span><strong>{formatMoney(row.actual_total_centavos)}</strong></div></Link>})}</div></>:<div className="mt-4"><EmptyState id="job-orders-empty-state" title={q||p.status?"No results match your filters":"No job orders yet"} description={q||p.status?"Try a different search or clear the current filters.":"Job orders appear here after a queue entry is converted."} action={q||p.status?<Button asChild variant="secondary"><Link href="/dashboard/jobs">Clear filters</Link></Button>:undefined}/></div>}
  </main>;
}

type JobDirectoryRow = {
  id: string;
  job_number: number | null;
  status: string;
  created_at: string;
  actual_total_centavos: number;
  technicianAssigned: boolean;
  customers: { full_name: string } | Array<{ full_name: string }> | null;
  vehicles: { make: string | null; model: string | null; plate_number: string | null } | Array<{ make: string | null; model: string | null; plate_number: string | null }> | null;
  job_order_items: Array<{ service_name_snapshot: string }>;
};

async function loadJobDirectory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  branchId: string,
  status?: string,
): Promise<{ rows: JobDirectoryRow[]; error: DatabaseError }> {
  const baseFields = "id,job_number,status,created_at,actual_total_centavos,customers(full_name),vehicles(make,model,plate_number),job_order_items(service_name_snapshot)";
  let canonicalQuery = supabase.from("job_orders").select(`${baseFields},primary_technician_staff_id`)
    .eq("organization_id",organizationId).eq("branch_id",branchId).order("created_at",{ascending:false}).limit(100);
  if(status) canonicalQuery=canonicalQuery.eq("status",status);
  const canonicalResult = await canonicalQuery;
  let resultData: unknown = canonicalResult.data;
  let resultError: DatabaseError = canonicalResult.error;
  let identityField = "primary_technician_staff_id";

  if (isMissingCanonicalAutomotiveStaffColumn(resultError)) {
    let legacyQuery = supabase.from("job_orders").select(`${baseFields},primary_technician_user_id`)
      .eq("organization_id",organizationId).eq("branch_id",branchId).order("created_at",{ascending:false}).limit(100);
    if(status) legacyQuery=legacyQuery.eq("status",status);
    const legacyResult = await legacyQuery;
    resultData = legacyResult.data;
    resultError = legacyResult.error;
    identityField = "primary_technician_user_id";
  }

  const rows = ((resultData ?? []) as Array<Omit<JobDirectoryRow,"technicianAssigned"> & Record<string, unknown>>)
    .map((row) => ({ ...row, technicianAssigned: Boolean(row[identityField]) }));
  return { rows, error: resultError };
}
