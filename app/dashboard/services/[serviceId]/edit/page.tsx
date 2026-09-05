import { notFound } from "next/navigation";
import { ServiceForm, type ServiceRecord } from "@/components/operations-forms";
import { FormDialog } from "@/components/management-ui";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { resolveIndustryConfig } from "@/modules/platform/industry";

export default async function Page({params,searchParams}:{params:Promise<{serviceId:string}>;searchParams:Promise<{error?:string}>}) {
  const [{serviceId},query,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  const config=resolveIndustryConfig(activeMembership.industry);
  const [{data:service},{data:categories},{data:branches},priceResult,{data:availability},{data:services}]=await Promise.all([
    supabase.from("services").select("id,name,category_id,description,short_description,code,duration_minutes,base_price_centavos,is_add_on,parent_service_id").eq("id",serviceId).eq("organization_id",activeMembership.organizationId).maybeSingle(),
    supabase.from("service_categories").select("id,name").eq("organization_id",activeMembership.organizationId).order("name"),
    supabase.from("branches").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    config.key==="automotive"?supabase.from("service_prices").select("branch_id,vehicle_class,price_centavos").eq("service_id",serviceId):Promise.resolve({data:[]}),
    supabase.from("service_branch_availability").select("branch_id").eq("service_id",serviceId).eq("is_available",true),
    supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).eq("is_add_on",false).order("name"),
  ]);
  if(!service) notFound();
  const prices=priceResult.data;
  const form=<ServiceForm automotivePricing={config.key==="automotive"} serviceLabel={config.terminology.service} idPrefix={config.key==="salon"?"salon-treatment":"service"} service={service as ServiceRecord} categories={categories??[]} branches={branches??[]} services={services??[]} prices={prices??[]} availableBranchIds={availability?.map(row=>row.branch_id)} error={query.error}/>;
  if(config.key==="salon") return <main id="salon-treatment-edit-page"><FormDialog id="salon-treatment-edit-dialog" title="Edit treatment" closeHref={`/dashboard/services/${serviceId}`} size="xl">{form}</FormDialog></main>;
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-brand-primary">{config.terminology.service}s</p><h1 className="mt-1 text-3xl font-black">Edit {config.terminology.service.toLowerCase()}</h1><div className="mt-6">{form}</div></div>;
}
