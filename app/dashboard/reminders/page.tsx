import Link from "next/link";

import { activateBackfilledMaintenance,dismissVehicleMaintenance,resumeVehicleMaintenance,saveMaintenanceRule,snoozeVehicleMaintenance } from "@/app/dashboard/reminders/actions";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { isMaintenanceAppointmentActive,type MaintenanceAppointmentStatus } from "@/modules/automotive/maintenance/reminder-eligibility";
import { verticalBrands } from "@/modules/platform/brand";

type MaintenanceRow={
  id:string;vehicle_id:string;customer_id:string;service_id:string;customer_name:string;service_name:string;
  make:string|null;model:string|null;plate_number:string|null;last_service_at:string;last_service_odometer_km:number|null;
  next_due_at:string|null;next_due_odometer_km:number|null;due_status:string;lifecycle_status:string;
  appointment_id:string|null;appointment_status:MaintenanceAppointmentStatus;appointment_starts_at:string|null;
  snoozed_until:string|null;notifications_enabled:boolean;source:"live"|"legacy_backfill";reminder_eligibility:string;
};
type DeliveryRow={due_id:string;channel:"email"|"sms";status:string;eligibility_reason:string|null;sent_at:string|null};
const statuses=["all","overdue","due","due_soon","upcoming"] as const;

function displayDate(value:string,timeZone:string,withTime=false){
  return new Intl.DateTimeFormat("en-PH",withTime?{dateStyle:"medium",timeStyle:"short",timeZone}:{dateStyle:"medium",timeZone}).format(new Date(value));
}

function dueLabel(row:MaintenanceRow,timeZone:string){
  const date=row.next_due_at?displayDate(row.next_due_at,timeZone):null;
  const km=row.next_due_odometer_km!=null?`${row.next_due_odometer_km.toLocaleString("en-PH")} km`:null;
  return [date,km].filter(Boolean).join(" or ");
}

function reminderLabel(row:MaintenanceRow,delivery:DeliveryRow[]|undefined,timeZone:string){
  if(row.reminder_eligibility==="ACTIVE_RELATED_APPOINTMENT")return"Suppressed — appointment active";
  if(row.reminder_eligibility==="SNOOZED"&&row.snoozed_until)return`Snoozed until ${displayDate(row.snoozed_until,timeZone)}`;
  if(row.reminder_eligibility==="LEGACY_BACKFILL_NOT_ACTIVATED")return"Paused — legacy backfill";
  const sent=delivery?.filter(item=>item.status==="sent").sort((a,b)=>String(b.sent_at).localeCompare(String(a.sent_at)))[0];
  if(sent)return`Sent by ${sent.channel.toUpperCase()}`;
  if(delivery?.some(item=>item.status==="pending"||item.status==="processing"))return"Queued";
  if(delivery?.some(item=>item.status==="failed"))return"Delivery failed";
  return"Eligible";
}

export default async function Page({searchParams}:{searchParams:Promise<{status?:string;q?:string;message?:string;error?:string;dialog?:string;id?:string}>}){
  const[query,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const selectedStatus=statuses.includes(query.status as typeof statuses[number])?query.status??"all":"all";
  const canManage=["owner","manager"].includes(activeMembership.role);
  const canOperate=["owner","manager","advisor"].includes(activeMembership.role);
  const[{data:directory},{data:services},{data:rules}]=await Promise.all([
    supabase.from("vehicle_maintenance_directory").select("*").eq("organization_id",activeMembership.organizationId).eq("lifecycle_status","active").order("next_due_at").limit(250),
    supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("maintenance_rules").select("*").eq("organization_id",activeMembership.organizationId).eq("is_active",true),
  ]);
  const rows=(directory??[]) as MaintenanceRow[];
  const{data:deliveryRows}=rows.length?await supabase.rpc("get_vehicle_maintenance_delivery_status",{p_due_ids:rows.map(row=>row.id)}):{data:[]};
  const deliveryByDue=new Map<string,DeliveryRow[]>();
  for(const delivery of (deliveryRows??[]) as DeliveryRow[])deliveryByDue.set(delivery.due_id,[...(deliveryByDue.get(delivery.due_id)??[]),delivery]);
  const search=(query.q??"").trim().toLocaleLowerCase();
  const filtered=rows.filter(row=>(selectedStatus==="all"||row.due_status===selectedStatus)&&(!search||[row.customer_name,row.service_name,row.make,row.model,row.plate_number].some(value=>value?.toLocaleLowerCase().includes(search))));
  const counts=Object.fromEntries(statuses.slice(1).map(status=>[status,rows.filter(row=>row.due_status===status).length]));
  const selected=rows.find(row=>row.id===query.id);
  return <main id="vehicle-maintenance-page" className="mx-auto max-w-7xl">
    <header id="vehicle-maintenance-page-header"><p className="text-sm font-bold text-brand-primary">{verticalBrands.automotive.displayName} retention</p><h1 className="text-3xl font-black">Maintenance</h1><p className="mt-1 text-sm text-zinc-600">Service recommendations, linked appointments, and reminder status.</p></header>
    <FormMessage message={query.message} error={query.error}/>
    <section id="maintenance-status-summary" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{statuses.slice(1).map(status=><Link id={`maintenance-${status}-filter`} key={status} href={`/dashboard/reminders?status=${status}`} className="rounded-xl border bg-white p-3"><span className="text-xs font-bold uppercase text-zinc-500">{status.replaceAll("_"," ")}</span><strong className="block text-2xl">{counts[status]??0}</strong></Link>)}</section>
    <form id="maintenance-filters" className="mt-4 flex flex-wrap gap-2"><Input id="maintenance-search-input" className="min-w-0 flex-1 sm:min-w-72" name="q" defaultValue={query.q} placeholder="Customer, vehicle, plate, or service"/><select id="maintenance-status-select" name="status" defaultValue={selectedStatus} className="min-h-11 rounded-xl border bg-white px-3">{statuses.map(status=><option key={status} value={status}>{status.replaceAll("_"," ")}</option>)}</select><Button id="maintenance-filter-button" type="submit">Filter</Button></form>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card id="maintenance-due-list" className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block"><table id="maintenance-due-table" className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-3">Vehicle</th><th className="px-3 py-3">Maintenance</th><th className="px-3 py-3">Due</th><th className="px-3 py-3">Appointment</th><th className="px-3 py-3">Reminder</th><th className="px-3 py-3">Actions</th></tr></thead><tbody>{filtered.map(row=><tr id={`maintenance-row-${row.id}`} key={row.id} className="border-t align-top"><td className="px-3 py-3"><Link className="font-bold" href={`/dashboard/vehicles/${row.vehicle_id}/history`}>{[row.make,row.model].filter(Boolean).join(" ")||"Vehicle"}</Link><small className="block text-zinc-500">{row.customer_name} · {row.plate_number||"No plate"}</small></td><td className="px-3 py-3 font-semibold">{row.service_name}<small className="block font-normal capitalize text-zinc-500">{row.due_status.replaceAll("_"," ")}</small></td><td className="px-3 py-3">{dueLabel(row,activeMembership.timezone)}</td><td id={`maintenance-linked-appointment-${row.id}`} className="px-3 py-3"><AppointmentStatus row={row} timeZone={activeMembership.timezone}/></td><td id={`maintenance-reminder-status-${row.id}`} className="px-3 py-3">{reminderLabel(row,deliveryByDue.get(row.id),activeMembership.timezone)}</td><td className="px-3 py-3"><MaintenanceActions row={row} canOperate={canOperate} canManage={canManage}/></td></tr>)}</tbody></table></div>
        <div className="grid gap-3 p-3 md:hidden">{filtered.map(row=><article id={`maintenance-card-${row.id}`} key={row.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><strong>{[row.make,row.model].filter(Boolean).join(" ")}</strong><span className="text-xs font-bold uppercase">{row.due_status.replaceAll("_"," ")}</span></div><p className="mt-1 font-semibold">{row.service_name}</p><p className="text-sm text-zinc-500">{row.customer_name} · {row.plate_number||"No plate"}</p><dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-xs font-bold uppercase text-zinc-500">Due</dt><dd>{dueLabel(row,activeMembership.timezone)}</dd></div><div id={`maintenance-linked-appointment-card-${row.id}`}><dt className="text-xs font-bold uppercase text-zinc-500">Appointment</dt><dd><AppointmentStatus row={row} timeZone={activeMembership.timezone}/></dd></div><div id={`maintenance-reminder-status-card-${row.id}`}><dt className="text-xs font-bold uppercase text-zinc-500">Reminder</dt><dd>{reminderLabel(row,deliveryByDue.get(row.id),activeMembership.timezone)}</dd></div></dl><div className="mt-3"><MaintenanceActions row={row} canOperate={canOperate} canManage={canManage}/></div></article>)}{!filtered.length?<p className="py-8 text-center text-sm text-zinc-500">No maintenance items match these filters.</p>:null}</div>
      </Card>
      {canManage?<Card id="maintenance-rule-card" className="h-fit p-5"><h2 className="font-black">Service intervals</h2><p className="mt-1 text-sm text-zinc-500">Shop-configured guidance; not a manufacturer claim.</p><form id="maintenance-rule-form" action={saveMaintenanceRule} className="mt-4 grid gap-3"><select id="maintenance-rule-service-select" required name="serviceId" className="min-h-11 rounded-xl border bg-white px-3"><option value="">Select service</option>{services?.map(service=><option key={service.id} value={service.id}>{service.name}</option>)}</select><Input id="maintenance-rule-months-input" name="intervalMonths" type="number" min="1" max="120" placeholder="Months"/><Input id="maintenance-rule-km-input" name="intervalKm" type="number" min="100" max="500000" placeholder="Kilometers"/><Input id="maintenance-rule-lead-input" required name="leadDays" type="number" min="0" max="365" defaultValue="14"/><SubmitButton id="maintenance-rule-save-button" pendingText="Saving…">Save interval</SubmitButton></form><div id="maintenance-rule-list" className="mt-5 space-y-2 text-sm">{rules?.map(rule=><p key={rule.id}><strong>{services?.find(service=>service.id===rule.service_id)?.name}</strong><br/><span className="text-zinc-500">{rule.interval_months?`${rule.interval_months} months`:""}{rule.interval_months&&rule.interval_km?" or ":""}{rule.interval_km?`${rule.interval_km.toLocaleString()} km`:""}</span></p>)}</div></Card>:null}
    </div>
    {query.dialog==="snooze"&&selected?<FormDialog id="maintenance-snooze-dialog" title="Snooze maintenance reminder" description="The maintenance due date stays unchanged." closeHref="/dashboard/reminders" size="md"><form id="maintenance-snooze-form" action={snoozeVehicleMaintenance} className="grid gap-4"><input type="hidden" name="id" value={selected.id}/><label className="text-sm font-semibold">Snooze until<Input id="maintenance-snooze-until-input" required name="snoozedUntil" type="date"/></label><label className="text-sm font-semibold">Reason (optional)<textarea id="maintenance-snooze-reason-input" name="reason" maxLength={500} className="mt-2 min-h-20 w-full rounded-xl border px-3 py-2"/></label><SubmitButton id="maintenance-snooze-confirm-button" pendingText="Snoozing…">Snooze reminder</SubmitButton></form></FormDialog>:null}
    {query.dialog==="dismiss"&&selected?<FormDialog id="maintenance-dismiss-dialog" title="Dismiss maintenance recommendation?" description="The due date remains in history, but reminders stop for this cycle." closeHref="/dashboard/reminders" size="md"><form id="maintenance-dismiss-form" action={dismissVehicleMaintenance} className="grid gap-4"><input type="hidden" name="id" value={selected.id}/><label className="text-sm font-semibold">Reason<textarea id="maintenance-dismiss-reason-input" required name="reason" maxLength={500} className="mt-2 min-h-24 w-full rounded-xl border px-3 py-2"/></label><SubmitButton id="maintenance-dismiss-confirm-button" variant="destructive" pendingText="Dismissing…">Dismiss recommendation</SubmitButton></form></FormDialog>:null}
  </main>;
}

function AppointmentStatus({row,timeZone}:{row:MaintenanceRow;timeZone:string}){
  if(!row.appointment_id)return <span className="text-zinc-500">Not booked</span>;
  const active=isMaintenanceAppointmentActive(row.appointment_status);
  return <span><strong className={active?"text-emerald-700":"text-zinc-600"}>{active?"Appointment scheduled":`Previous appointment ${row.appointment_status?.replaceAll("_"," ")??"unavailable"}`}</strong>{row.appointment_starts_at?<small className="block text-zinc-500">{displayDate(row.appointment_starts_at,timeZone,true)}</small>:null}</span>;
}

function MaintenanceActions({row,canOperate,canManage}:{row:MaintenanceRow;canOperate:boolean;canManage:boolean}){
  const activeAppointment=row.appointment_id&&isMaintenanceAppointmentActive(row.appointment_status);
  const snoozed=row.snoozed_until&&new Date(row.snoozed_until)>new Date();
  return <div className="flex min-w-36 flex-wrap gap-2">{activeAppointment?<Button id={`maintenance-view-appointment-button-${row.id}`} asChild size="sm"><Link href={`/dashboard/appointments/${row.appointment_id}`}>View appointment</Link></Button>:<Button id={`maintenance-create-appointment-button-${row.id}`} asChild size="sm"><Link href={`/dashboard/appointments/new?maintenanceDueId=${row.id}`}>Create appointment</Link></Button>}{canOperate?(snoozed?<form action={resumeVehicleMaintenance}><input type="hidden" name="id" value={row.id}/><SubmitButton id={`maintenance-resume-reminders-button-${row.id}`} size="sm" variant="secondary" pendingText="Resuming…">Resume</SubmitButton></form>:<Button id={`maintenance-snooze-button-${row.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/reminders?dialog=snooze&id=${row.id}`}>Snooze</Link></Button>):null}{canManage&&!row.notifications_enabled?<form action={activateBackfilledMaintenance}><input type="hidden" name="id" value={row.id}/><SubmitButton id={`maintenance-activate-reminders-button-${row.id}`} size="sm" variant="secondary" pendingText="Activating…">Activate reminders</SubmitButton></form>:null}{canOperate?<Button id={`maintenance-dismiss-button-${row.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/reminders?dialog=dismiss&id=${row.id}`}>Dismiss</Link></Button>:null}</div>;
}
