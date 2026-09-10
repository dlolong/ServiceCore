import Link from "next/link";
import { startQueueJob } from "@/app/dashboard/job-actions";
import { transitionQueue } from "@/app/dashboard/operations-actions";
import { FormMessage } from "@/components/form-message";
import { OpenQueueDisplay } from "@/components/open-queue-display";
import { FilterBar, PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WorkSessionTimer } from "@/components/work-session-timer";
import { getDashboardContext } from "@/lib/auth/context";
import { formatDuration, formatMoney, queueLabel } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { assignmentContextLabel, loadKarKRAppointmentAssignmentContext } from "@/modules/automotive/scheduling/appointment-operational-view";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; message?: string; error?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: activeMembership.timezone }).format(new Date());
  const search = params.q?.trim().slice(0, 100);
  let directory = supabase.from("queue_directory").select("id").eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).eq("queue_date", today).order("queue_number");
  if (search) directory = directory.ilike("search_document", `%${search.replace(/[,%()]/g, " ")}%`);
  const { data: matches, error: searchError } = await directory;
  const ids = matches?.map(({ id }) => id) ?? [];
  const { data, error } = ids.length ? await supabase.from("queue_entries").select("id,source,queue_number,status,checked_in_at,estimated_total_centavos,estimated_duration_minutes,customers(full_name),vehicles(make,model,plate_number),appointments(id,appointment_services(service_name_snapshot))").in("id", ids) : { data: [], error: null };
  const byId = new Map(data?.map((row) => [row.id, row]));
  const entries = ids.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
  const { data: queueJobs } = ids.length ? await supabase.from("job_orders").select("id,queue_entry_id,status,primary_technician_staff_id").eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).in("queue_entry_id",ids) : { data: [] };
  const jobIds=(queueJobs??[]).map(job=>job.id);
  const { data: activeWork }=jobIds.length?await supabase.from("automotive_job_order_work_sessions").select("id,job_order_id,technician_name_snapshot,started_at").eq("organization_id",activeMembership.organizationId).eq("branch_id",activeMembership.branchId).eq("status","active").in("job_order_id",jobIds):{data:[]};
  const jobsByQueue=new Map((queueJobs??[]).map(job=>[job.queue_entry_id,job]));
  const activeByJob=new Map((activeWork??[]).map(session=>[session.job_order_id,session]));
  const appointmentIds = entries.flatMap(({ appointments }) => { const appointment = Array.isArray(appointments) ? appointments[0] : appointments; return appointment?.id ? [appointment.id] : []; });
  const assignmentContext = await loadKarKRAppointmentAssignmentContext(activeMembership.organizationId, appointmentIds);
  const canWrite = ["owner", "manager", "advisor"].includes(activeMembership.role);
  const active = entries.filter(({ status }) => !["cancelled", "converted_to_job"].includes(status));

  return <main id="queue-page" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="queue-page-header" eyebrow={activeMembership.branchName} title="Today’s Queue" description={`${active.length} active vehicle${active.length === 1 ? "" : "s"}.`} action={<div className="flex flex-wrap gap-2"><OpenQueueDisplay branchId={activeMembership.branchId}/>{canWrite?<Button asChild><Link id="queue-add-walk-in-button" href="/dashboard/queue/new">Add walk-in</Link></Button>:null}</div>}/><FormMessage message={params.message} error={params.error ?? (searchError || error ? "Unable to load the queue." : undefined)}/><FilterBar id="queue-filter-bar"><form id="queue-search-form" className="flex flex-col gap-2 min-[380px]:flex-row"><input id="queue-search-input" className="min-h-11 min-w-0 grow rounded-xl border bg-white px-3" name="q" defaultValue={params.q} placeholder="Queue number, customer, plate, or vehicle"/><Button id="queue-search-button" type="submit" variant="secondary">Search</Button></form></FilterBar><div id="queue-list" className="mt-4 grid gap-3 md:grid-cols-2">{entries.map((entry) => {
    const customer = Array.isArray(entry.customers) ? entry.customers[0] : entry.customers;
    const vehicle = Array.isArray(entry.vehicles) ? entry.vehicles[0] : entry.vehicles;
    const appointment = Array.isArray(entry.appointments) ? entry.appointments[0] : entry.appointments;
    const context = appointment?.id ? assignmentContext.get(appointment.id) ?? { scheduledStaff: [], scheduledResources: [] } : { scheduledStaff: [], scheduledResources: [] };
    const labels = assignmentContextLabel(context);
    const eligibleStaff = context.scheduledStaff.filter(({ canInitializeJobOrder }) => canInitializeJobOrder);
    const job=jobsByQueue.get(entry.id),activeSession=job?activeByJob.get(job.id):null;
    return <Card id={`queue-card-${entry.id}`} className="p-5" key={entry.id}><div className="flex justify-between gap-3"><strong className="text-2xl text-brand-primary-strong">{queueLabel(entry.source as "appointment" | "walk_in", entry.queue_number)}</strong><span className="capitalize">{entry.status.replaceAll("_", " ")}</span></div><h2 className="mt-4 font-semibold">{vehicle?.make} {vehicle?.model}{vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ""}</h2><p className="text-sm text-zinc-600">{customer?.full_name}</p><p className="mt-2 text-sm">{appointment?.appointment_services.map(({ service_name_snapshot }) => service_name_snapshot).join(", ")}</p><dl className="mt-3 grid gap-1 text-xs text-zinc-600"><div><dt className="inline font-bold">Scheduled Staff: </dt><dd className="inline break-words">{labels.staff}</dd></div><div><dt className="inline font-bold">Service Bay: </dt><dd className="inline break-words">{labels.resources}</dd></div></dl>{activeSession?<div id={`queue-active-work-${entry.id}`} className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm"><span><strong>{activeSession.technician_name_snapshot}</strong><small className="block text-emerald-800">Working</small></span><WorkSessionTimer id={`queue-active-work-timer-${entry.id}`} startedAt={activeSession.started_at} className="font-semibold text-emerald-800"/></div>:job?<div className="mt-3 text-xs font-semibold capitalize text-zinc-500">Job: {job.status.replaceAll("_"," ")}</div>:null}<div className="mt-3 flex justify-between text-xs text-zinc-500"><span>{formatDuration(entry.estimated_duration_minutes)}</span><span>{formatMoney(entry.estimated_total_centavos)}</span></div>{canWrite&&<div className="mt-5 flex flex-wrap gap-2">{entry.status === "waiting"&&<QueueAction id={entry.id} status="called" label="Call vehicle"/>}{entry.status === "called"&&<QueueAction id={entry.id} status="ready" label="Mark ready"/>}{["waiting", "called"].includes(entry.status)&&<QueueAction id={entry.id} status="cancelled" label="Cancel"/>}{["waiting", "called", "ready"].includes(entry.status)&&<form id={`appointment-job-order-conversion-form-${entry.id}`} action={startQueueJob} className="w-full rounded-xl border border-zinc-200 p-3"><input type="hidden" name="queueId" value={entry.id}/><div id={`appointment-job-order-scheduled-staff-${entry.id}`} className="text-xs"><strong>Scheduled Staff:</strong> {labels.staff}</div><div id={`appointment-job-order-scheduled-resource-${entry.id}`} className="mt-1 text-xs"><strong>Scheduled Service Bay:</strong> {labels.resources}</div>{eligibleStaff.length > 0&&<><label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold"><input id={`appointment-job-order-copy-staff-checkbox-${entry.id}`} name="copyScheduledStaff" type="checkbox"/> Assign scheduled staff to this Job Order</label>{eligibleStaff.length === 1 ? <input type="hidden" name="scheduledStaffId" value={eligibleStaff[0].id}/> : <label className="block text-xs font-semibold">Initial technician<select id={`appointment-job-order-staff-select-${entry.id}`} name="scheduledStaffId" defaultValue="" className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2"><option value="">Select scheduled technician</option>{eligibleStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.displayName}</option>)}</select></label>}</>}<SubmitButton id={`appointment-job-order-convert-button-${entry.id}`} className="mt-2" pendingText="Starting…">Start job</SubmitButton></form>}</div>}</Card>;
  })}{!entries.length&&<Card id="queue-empty-state" elevation="none" className="p-10 text-center md:col-span-2"><h2 className="font-semibold">No matching vehicles</h2><p className="mt-1 text-sm text-slate-600">New arrivals and scheduled check-ins will appear here.</p></Card>}</div></main>;
}

function QueueAction({ id, status, label }: { id: string; status: string; label: string }) {
  return <form id={`queue-${status}-form-${id}`} action={transitionQueue}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value={status}/><SubmitButton id={`queue-${status}-button-${id}`} pendingText="Updating…" variant="secondary">{label}</SubmitButton></form>;
}
