import { notFound } from "next/navigation";
import { ServiceForm, type ServiceRecord } from "@/components/operations-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function Page({params,searchParams}:{params:Promise<{serviceId:string}>;searchParams:Promise<{error?:string}>}) {
  const [{serviceId},query,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  const [{data:service},{data:categories},{data:branches},{data:prices},{data:availability},{data:services}]=await Promise.all([
    supabase.from("services").select("id,name,category_id,description,short_description,code,duration_minutes,base_price_centavos,is_add_on,parent_service_id").eq("id",serviceId).eq("organization_id",activeMembership.organizationId).maybeSingle(),
    supabase.from("service_categories").select("id,name").eq("organization_id",activeMembership.organizationId).order("name"),
    supabase.from("branches").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("service_prices").select("branch_id,vehicle_class,price_centavos").eq("service_id",serviceId),
    supabase.from("service_branch_availability").select("branch_id").eq("service_id",serviceId).eq("is_available",true),
    supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).eq("is_add_on",false).order("name"),
  ]);
  if(!service) notFound();
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-amber-700">Services</p><h1 className="mt-1 text-3xl font-black">Edit service</h1><div className="mt-6"><ServiceForm service={service as ServiceRecord} categories={categories??[]} branches={branches??[]} services={services??[]} prices={prices??[]} availableBranchIds={availability?.map(row=>row.branch_id)} error={query.error}/></div></div>;
}
