import Link from "next/link";

import { endTechnicianWork } from "@/app/dashboard/job-actions";
import { FormMessage } from "@/components/form-message";
import { EmptyState, PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkSessionTimer } from "@/components/work-session-timer";
import { getDashboardContext } from "@/lib/auth/context";
import { jobNumber } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { formatWorkDuration, getAutomotiveWorkSessionElapsedSeconds, type AutomotiveWorkSession } from "@/modules/automotive/work-tracking/work-session.service";

type Query = { message?: string; error?: string };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const [{ data: jobs, error: jobsError }, { data: sessionRows, error: sessionsError }, { data: actorStaff }] = await Promise.all([
    supabase.from("job_orders").select("id,job_number,status,created_at,primary_technician_staff_id,customers(full_name),vehicles(make,model,plate_number),job_order_items(technician_staff_id)").eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).not("status", "in", "(completed,cancelled)").order("created_at", { ascending: false }).limit(100),
    supabase.from("automotive_job_order_work_sessions").select("id,job_order_id,technician_staff_id,technician_user_id,technician_name_snapshot,started_at,ended_at,status,end_reason,notes").eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).order("started_at", { ascending: false }).limit(250),
    supabase.from("organization_staff_profiles").select("id").eq("organization_id",activeMembership.organizationId).eq("membership_id",activeMembership.membershipId).maybeSingle(),
  ]);
  const sessions = ((sessionRows ?? []) as Record<string, unknown>[]).map(mapSession);
  const active = sessions.filter(({ status }) => status === "active");
  const isManager = ["owner", "manager", "advisor"].includes(activeMembership.role);
  const ownActive = active.filter(({ staffId }) => staffId === actorStaff?.id);
  const visibleActive = isManager ? active : ownActive;
  const assignedJobs = (jobs ?? []).filter((job) => isManager || job.primary_technician_staff_id === actorStaff?.id || job.job_order_items.some((item: { technician_staff_id: string | null }) => item.technician_staff_id === actorStaff?.id));
  const jobsById = new Map((jobs ?? []).map((job) => [job.id, job]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: activeMembership.timezone }).format(new Date());
  const completedToday = sessions.filter((session) => session.staffId === actorStaff?.id && session.endedAt && new Intl.DateTimeFormat("en-CA", { timeZone: activeMembership.timezone }).format(new Date(session.endedAt)) === today);
  return <main id="technician-my-work-page" className="mx-auto max-w-7xl">
    <PageHeader id="technician-my-work-header" eyebrow={activeMembership.branchName} title={isManager ? "Technician Work" : "My Work"} description={isManager ? "Current technician sessions and assigned Job Orders." : "Your active timer and assigned Job Orders."} action={<Button asChild variant="secondary"><Link href="/dashboard/jobs">All Job Orders</Link></Button>}/>
    <FormMessage {...query} error={query.error ?? (jobsError || sessionsError ? "Unable to load technician work." : undefined)}/>
    <section id="technician-active-job" className="mt-4"><h2 className="text-sm font-black uppercase tracking-wide text-zinc-500">{isManager ? "Currently Working" : "Currently Working On"}</h2>
      {visibleActive.length ? <div className="mt-2 grid gap-3 lg:grid-cols-2">{visibleActive.map((session) => {
        const job = jobsById.get(session.jobOrderId); const vehicle = job ? one(job.vehicles) : null; const customer = job ? one(job.customers) : null;
        return <Card id={`technician-active-job-${session.id}`} key={session.id} className="border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-emerald-800">{session.technicianName}</p><h3 className="mt-1 font-black">{vehicle ? `${vehicle.make} ${vehicle.model}${vehicle.plate_number ? ` · ${vehicle.plate_number}` : ""}` : "Active Job Order"}</h3><p className="text-sm text-zinc-600">{job ? jobNumber(job.job_number ?? 0, new Date(job.created_at).getFullYear()) : session.jobOrderId} · {customer?.full_name ?? "Customer"}</p></div><WorkSessionTimer id={`technician-active-job-timer-${session.id}`} startedAt={session.startedAt} className="text-xl font-black text-emerald-800"/></div><div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm" variant="secondary"><Link id={`technician-view-job-button-${session.id}`} href={`/dashboard/jobs/${session.jobOrderId}`}>View Job</Link></Button><SessionEndForm session={session} action="pause"/><SessionEndForm session={session} action="stop"/></div></Card>;
      })}</div> : <EmptyState id="technician-no-active-job" title="No active job" description={isManager ? "No technician currently has an active work session in this branch." : "Start work from an assigned Job Order when its inspection, approval, and parts are ready."}/>}</section>
    <section id="technician-assigned-jobs" className="mt-6"><h2 className="text-sm font-black uppercase tracking-wide text-zinc-500">Assigned Jobs</h2>{assignedJobs.length ? <div className="mt-2 hidden overflow-hidden rounded-2xl border bg-white md:block"><table id="technician-assigned-jobs-table" className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Job</th><th className="px-4 py-3">Vehicle / customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{assignedJobs.map((job) => { const vehicle=one(job.vehicles),customer=one(job.customers); return <tr id={`technician-assigned-job-row-${job.id}`} key={job.id}><td className="px-4 py-3 font-bold">{jobNumber(job.job_number??0,new Date(job.created_at).getFullYear())}</td><td className="px-4 py-3"><strong>{vehicle?.make} {vehicle?.model}</strong><small className="block text-zinc-500">{customer?.full_name}</small></td><td className="px-4 py-3 capitalize">{job.status.replaceAll("_"," ")}</td><td className="px-4 py-3 text-right"><Button asChild size="sm" variant="secondary"><Link href={`/dashboard/jobs/${job.id}#job-order-work-tracking-section`}>Open</Link></Button></td></tr>;})}</tbody></table></div> : <p className="mt-2 text-sm text-zinc-500">No assigned active Job Orders.</p>}
      <div id="technician-assigned-jobs-mobile" className="mt-2 grid gap-2 md:hidden">{assignedJobs.map((job) => { const vehicle=one(job.vehicles),customer=one(job.customers); return <Link id={`technician-assigned-job-card-${job.id}`} key={job.id} href={`/dashboard/jobs/${job.id}#job-order-work-tracking-section`} className="rounded-xl border bg-white p-4"><div className="flex justify-between gap-3"><strong>{jobNumber(job.job_number??0,new Date(job.created_at).getFullYear())}</strong><span className="text-xs font-bold capitalize">{job.status.replaceAll("_"," ")}</span></div><p className="mt-2 font-semibold">{vehicle?.make} {vehicle?.model}</p><p className="text-sm text-zinc-500">{customer?.full_name}</p></Link>;})}</div>
    </section>
    {!isManager ? <section id="technician-completed-today" className="mt-6 rounded-2xl border bg-white p-4"><h2 className="font-black">Completed sessions today</h2><p className="mt-1 text-2xl font-black">{completedToday.length}</p><p className="text-sm text-zinc-500">{formatWorkDuration(completedToday.reduce((sum, session) => sum + getAutomotiveWorkSessionElapsedSeconds(session), 0))} labor effort</p></section> : null}
  </main>;
}

function SessionEndForm({ session, action }: { session: AutomotiveWorkSession; action: "pause" | "stop" }) {
  return <form id={`technician-${action}-work-form-${session.id}`} action={endTechnicianWork}><input type="hidden" name="jobId" value={session.jobOrderId}/><input type="hidden" name="sessionId" value={session.id}/><input type="hidden" name="action" value={action}/><SubmitButton id={`technician-${action}-work-button-${session.id}`} size="sm" pendingText="Saving…" variant={action === "stop" ? "destructive" : "secondary"}>{action === "pause" ? "Pause" : "Stop session"}</SubmitButton></form>;
}

function mapSession(session: Record<string, unknown>): AutomotiveWorkSession { return { id:String(session.id),jobOrderId:String(session.job_order_id),staffId:String(session.technician_staff_id),userId:session.technician_user_id?String(session.technician_user_id):null,technicianName:String(session.technician_name_snapshot),startedAt:String(session.started_at),endedAt:session.ended_at?String(session.ended_at):null,status:String(session.status) as AutomotiveWorkSession["status"],endReason:session.end_reason?String(session.end_reason) as AutomotiveWorkSession["endReason"]:null,notes:session.notes?String(session.notes):null }; }
function one<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
