import Link from "next/link";
import { notFound } from "next/navigation";
import { toggleService } from "@/app/dashboard/operations-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { formatDuration, formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

export default async function Page({params,searchParams}:{params:Promise<{serviceId:string}>;searchParams:Promise<{message?:string;error?:string}>}) {
  const [{serviceId},p,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  const salon=activeMembership.industry==="salon";
  const [{data:s},priceResult,{data:availability}]=await Promise.all([
    supabase.from("services").select("id,name,description,duration_minutes,base_price_centavos,is_active,is_add_on,code,service_categories(name)").eq("id",serviceId).eq("organization_id",activeMembership.organizationId).maybeSingle(),
    salon?Promise.resolve({data:[]}):supabase.from("service_prices").select("vehicle_class,price_centavos,branches(name)").eq("service_id",serviceId),
    supabase.from("service_branch_availability").select("branches(name)").eq("service_id",serviceId).eq("is_available",true),
  ]);
  if(!s) notFound();
  const category=Array.isArray(s.service_categories)?s.service_categories[0]:s.service_categories;
  const canManage=["owner","manager"].includes(activeMembership.role);
  const prices=priceResult.data;
  const serviceLabel=salon?"treatment":"service";
  return <div id={salon?"salon-treatment-detail-page":undefined} className="mx-auto max-w-4xl"><div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm font-bold text-brand-primary">{category?.name??(salon?"Treatment":"Service")}</p><h1 className="mt-1 text-3xl font-semibold">{s.name}</h1><p className="mt-2 text-zinc-600">{s.description||"No description"}</p></div>{canManage&&<Button id={salon?"salon-treatment-edit-button":undefined} asChild><Link href={`/dashboard/services/${s.id}/edit`}>Edit {serviceLabel}</Link></Button>}</div><FormMessage {...p}/><div className="mt-6 grid gap-5 sm:grid-cols-2"><Card className="p-5"><h2 className="font-semibold">Base price</h2><p className="mt-3 text-3xl font-semibold">{formatMoney(s.base_price_centavos)}</p><p className="mt-1 text-zinc-600">{formatDuration(s.duration_minutes)} · {s.is_add_on?"Add-on":salon?"Treatment":"Service"}</p>{s.code&&<p className="mt-3 text-sm text-zinc-500">Code: {s.code}</p>}</Card>{!salon&&<Card className="p-5"><h2 className="font-semibold">Vehicle pricing</h2><dl className="mt-3 space-y-2 text-sm">{prices?.map((price,i)=>{const branch=Array.isArray(price.branches)?price.branches[0]:price.branches;return <div className="flex justify-between gap-3" key={i}><dt>{price.vehicle_class?.replaceAll("_"," ")||"Branch base"}{branch?` · ${branch.name}`:""}</dt><dd className="font-bold">{formatMoney(price.price_centavos)}</dd></div>})}{!prices?.length&&<p className="text-zinc-600">Uses the base price for every vehicle.</p>}</dl></Card>}<Card className={`p-5 ${salon?"sm:col-span-1":"sm:col-span-2"}`}><h2 className="font-semibold">Availability</h2><p className="mt-2 text-sm text-zinc-600">{availability?.length?availability.map(a=>(Array.isArray(a.branches)?a.branches[0]:a.branches)?.name).filter(Boolean).join(", "):"All active branches"}</p>{canManage&&<form action={toggleService} className="mt-5"><input type="hidden" name="id" value={s.id}/><input type="hidden" name="active" value={String(!s.is_active)}/><SubmitButton variant={s.is_active?"destructive":"secondary"} pendingText="Updating…">{s.is_active?`Deactivate ${serviceLabel}`:`Activate ${serviceLabel}`}</SubmitButton></form>}</Card></div></div>;
}
