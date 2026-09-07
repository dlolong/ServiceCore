import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { vehicleLabel } from "@/lib/crm";
import { formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

type HistoryRow={job_order_id:string;job_number:number|null;completed_at:string;odometer_in_km:number|null;total_centavos:number;services:{name:string;quantity:number;total_centavos:number}[]};
type DueRow={id:string;customer_id:string;service_id:string;service_name:string;due_status:string;next_due_at:string|null;next_due_odometer_km:number|null};
type PartHistoryRecord={source_job_order_id:string;vehicle_service_record_parts:{part_name_snapshot:string;quantity_consumed:number;unit_snapshot:string}[]};

export default async function Page({params}:{params:Promise<{vehicleId:string}>}){
  const[{vehicleId},{activeMembership},supabase]=await Promise.all([params,getDashboardContext(),createClient()]);
  const{data:vehicle}=await supabase.from("vehicles").select("id,make,model,model_year,plate_number,customer_id,odometer_km").eq("id",vehicleId).eq("organization_id",activeMembership.organizationId).maybeSingle();
  if(!vehicle)notFound();
  const[{data:history},{data:maintenance},{data:partHistory}]=await Promise.all([
    supabase.from("vehicle_service_history").select("*").eq("vehicle_id",vehicle.id).eq("organization_id",activeMembership.organizationId).order("completed_at",{ascending:false}),
    supabase.from("vehicle_maintenance_directory").select("id,customer_id,service_id,service_name,due_status,next_due_at,next_due_odometer_km").eq("vehicle_id",vehicle.id).eq("organization_id",activeMembership.organizationId).eq("lifecycle_status","active").order("next_due_at"),
    supabase.from("vehicle_service_records").select("source_job_order_id,vehicle_service_record_parts(part_name_snapshot,quantity_consumed,unit_snapshot)").eq("vehicle_id",vehicle.id).eq("organization_id",activeMembership.organizationId),
  ]);
  const partsByJob=new Map(((partHistory??[]) as PartHistoryRecord[]).map(record=>[record.source_job_order_id,record.vehicle_service_record_parts]));
  const records=((history??[]) as HistoryRow[]).map(record=>({...record,services:[...record.services,...(partsByJob.get(record.job_order_id)??[]).map(part=>({name:`${part.part_name_snapshot} (${Number(part.quantity_consumed).toLocaleString("en-PH",{maximumFractionDigits:3})} ${part.unit_snapshot} used)`,quantity:1,total_centavos:0}))]}));
  const due=(maintenance??[]) as DueRow[];
  const date=(value:string)=>new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeZone:activeMembership.timezone}).format(new Date(value));
  return <main id="vehicle-history-page" className="mx-auto max-w-6xl">
    <header id="vehicle-history-page-header" className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-brand-primary">Vehicle history</p><h1 className="text-3xl font-semibold">{vehicleLabel(vehicle)}</h1><p className="mt-1 text-sm text-zinc-500">Current odometer: {vehicle.odometer_km==null?"Not captured":`${vehicle.odometer_km.toLocaleString("en-PH")} km`}</p></div><Button id="vehicle-history-back-button" asChild variant="secondary"><Link href={`/dashboard/vehicles/${vehicle.id}`}>Vehicle overview</Link></Button></header>
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card id="vehicle-service-history-card" className="overflow-hidden"><div className="border-b p-4"><h2 className="font-semibold">Completed service history</h2><p className="text-xs text-zinc-500">Final approved work captured when each Job Order was released.</p></div><div className="hidden overflow-x-auto sm:block"><table id="vehicle-service-history-table" className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Work performed</th><th className="px-4 py-3">Odometer</th><th className="px-4 py-3 text-right">Actual total</th></tr></thead><tbody>{records.map(record=><tr id={`vehicle-service-history-row-${record.job_order_id}`} key={record.job_order_id} className="border-t"><td className="px-4 py-3"><Link className="font-bold" href={`/dashboard/jobs/${record.job_order_id}`}>{date(record.completed_at)}</Link><small className="block text-zinc-500">Job {record.job_number??"—"}</small></td><td className="px-4 py-3">{record.services.map(item=>`${item.name}${item.quantity>1?` × ${item.quantity}`:""}`).join(", ")}</td><td className="px-4 py-3">{record.odometer_in_km==null?"—":`${record.odometer_in_km.toLocaleString("en-PH")} km`}</td><td className="px-4 py-3 text-right font-bold">{formatMoney(record.total_centavos)}</td></tr>)}</tbody></table></div><div className="grid gap-3 p-3 sm:hidden">{records.map(record=><Link id={`vehicle-service-history-card-${record.job_order_id}`} href={`/dashboard/jobs/${record.job_order_id}`} key={record.job_order_id} className="rounded-xl border p-4 text-zinc-950"><div className="flex justify-between gap-3"><strong>{date(record.completed_at)}</strong><strong>{formatMoney(record.total_centavos)}</strong></div><p className="mt-2 text-sm">{record.services.map(item=>`${item.name}${item.quantity>1?` × ${item.quantity}`:""}`).join(", ")}</p><small className="text-zinc-500">{record.odometer_in_km==null?"Odometer not captured":`${record.odometer_in_km.toLocaleString("en-PH")} km`}</small></Link>)}{!records.length?<p className="py-8 text-center text-sm text-zinc-500">No completed services have been captured yet.</p>:null}</div></Card>
      <Card id="vehicle-maintenance-summary" className="h-fit p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold">Upcoming maintenance</h2><Link className="text-sm font-bold text-brand-primary-strong" href="/dashboard/reminders">View all</Link></div><div className="mt-3 divide-y">{due.map(item=>{const booking=new URLSearchParams({customerId:item.customer_id,vehicleId:vehicle.id,serviceId:item.service_id});return <article id={`vehicle-maintenance-item-${item.id}`} key={item.id} className="py-3"><div className="flex justify-between gap-3"><strong>{item.service_name}</strong><span className="text-xs font-bold uppercase">{item.due_status.replaceAll("_"," ")}</span></div><p className="mt-1 text-sm text-zinc-500">{[item.next_due_at?date(item.next_due_at):null,item.next_due_odometer_km!=null?`${item.next_due_odometer_km.toLocaleString("en-PH")} km`:null].filter(Boolean).join(" or ")}</p><Link id={`vehicle-maintenance-book-${item.id}`} className="mt-2 inline-block text-sm font-bold text-brand-primary-strong" href={`/dashboard/appointments/new?${booking}`}>Create appointment</Link></article>})}{!due.length?<p className="py-6 text-sm text-zinc-500">No active maintenance recommendations.</p>:null}</div></Card>
    </div>
  </main>;
}
