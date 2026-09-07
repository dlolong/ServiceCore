import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveCustomer } from "@/app/dashboard/crm-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { displayPhone } from "@/lib/crm";
import { createClient } from "@/lib/supabase/server";

type CustomerRecord={id:string;full_name:string;phone:string|null;email:string|null;address_line:string|null;city:string|null;province:string|null;notes:string|null;is_archived:boolean;created_at:string;vehicles?:Array<{id:string;make:string|null;model:string|null;model_year:number|null;plate_number:string|null;is_archived:boolean}>};

export default async function Page({params,searchParams}:{params:Promise<{customerId:string}>;searchParams:Promise<{message?:string;error?:string}>}){
  const[{customerId},query,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  const salon=activeMembership.industry==="salon";
  const projection=salon?"id,full_name,phone,email,address_line,city,province,notes,is_archived,created_at":"id,full_name,phone,email,address_line,city,province,notes,is_archived,created_at,vehicles(id,make,model,model_year,plate_number,is_archived)";
  const customerResult=await supabase.from("customers").select(projection).eq("id",customerId).eq("organization_id",activeMembership.organizationId).maybeSingle();
  const data=customerResult.data as unknown as CustomerRecord|null;
  if(!data)notFound();
  const{data:appointments}=salon?await supabase.from("appointments").select("id,status,starts_at,appointment_services(service_name_snapshot)").eq("organization_id",activeMembership.organizationId).eq("customer_id",customerId).order("starts_at",{ascending:false}).limit(8):{data:[]};
  const canWrite=["owner","manager","advisor"].includes(activeMembership.role);
  return <main id={salon?"salon-client-detail-page":"customer-detail-page"} className="mx-auto max-w-5xl">
    <header className="flex flex-wrap justify-between gap-4"><div><p className="text-sm font-bold text-brand-primary">{salon?"Client":"Customer"}</p><h1 className="mt-1 text-3xl font-semibold">{data.full_name}</h1><p className="mt-2 text-zinc-600">{displayPhone(data.phone)}{data.email?` · ${data.email}`:""}</p></div>{canWrite&&<div className="flex gap-2"><Button asChild variant="secondary"><Link href={`/dashboard/customers?edit=${data.id}`}>Edit</Link></Button>{!salon?<Button asChild><Link href={`/dashboard/vehicles/new?customerId=${data.id}`}>Add vehicle</Link></Button>:<Button asChild><Link href={`/dashboard/appointments/new?customerId=${data.id}`}>Book appointment</Link></Button>}</div>}</header>
    <FormMessage {...query}/>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_2fr]"><Card className="p-5"><h2 className="font-semibold">Contact details</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-zinc-500">Address</dt><dd className="font-semibold">{[data.address_line,data.city,data.province].filter(Boolean).join(", ")||"Not provided"}</dd></div><div><dt className="text-zinc-500">Notes</dt><dd className="whitespace-pre-wrap">{data.notes||"No notes"}</dd></div></dl>{canWrite&&<form action={archiveCustomer} className="mt-6"><input type="hidden" name="id" value={data.id}/><input type="hidden" name="archived" value={String(!data.is_archived)}/><SubmitButton variant="destructive" pendingText="Updating…">{data.is_archived?`Restore ${salon?"client":"customer"}`:`Archive ${salon?"client":"customer"}`}</SubmitButton></form>}</Card>
      {salon?<Card id="salon-client-appointments" className="p-5"><h2 className="font-semibold">Appointment history</h2><div className="mt-3 divide-y">{appointments?.map(appointment=><Link id={`salon-client-appointment-${appointment.id}`} key={appointment.id} href={`/dashboard/appointments/${appointment.id}`} className="flex items-center justify-between gap-3 py-3 text-sm"><span><strong>{appointment.appointment_services.map(item=>item.service_name_snapshot).join(", ")}</strong><small className="block text-zinc-500">{appointment.starts_at?new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:activeMembership.timezone}).format(new Date(appointment.starts_at)):"Not scheduled"}</small></span><span className="capitalize">{appointment.status.replaceAll("_"," ")}</span></Link>)}{!appointments?.length?<p className="py-8 text-center text-sm text-zinc-500">No appointments yet.</p>:null}</div></Card>:<div><h2 className="text-lg font-semibold">Vehicles</h2><div className="mt-3 grid gap-3">{data.vehicles?.filter(vehicle=>!vehicle.is_archived).map(vehicle=><Link key={vehicle.id} className="rounded-2xl border border-zinc-200 bg-white p-4 font-bold text-zinc-950 hover:border-brand-border" href={`/dashboard/vehicles/${vehicle.id}`}>{[vehicle.model_year,vehicle.make,vehicle.model,vehicle.plate_number&&`(${vehicle.plate_number})`].filter(Boolean).join(" ")}</Link>)}{!data.vehicles?.some(vehicle=>!vehicle.is_archived)&&<Card className="p-6 text-center text-sm text-zinc-600">No active vehicles yet.</Card>}</div><Card className="mt-5 p-5"><h2 className="font-semibold">Recent activity</h2><p className="mt-2 text-sm text-zinc-600">Service history will appear here after job orders are completed.</p></Card></div>}
    </div>
  </main>;
}
