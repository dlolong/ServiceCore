import { ServiceForm } from "@/components/operations-forms";
import { FormDialog } from "@/components/management-ui";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { resolveIndustryConfig } from "@/modules/platform/industry";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const [params,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const [{data:categories},{data:branches},{data:services}]=await Promise.all([
    supabase.from("service_categories").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("branches").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).eq("is_add_on",false).order("name"),
  ]);
  const config=resolveIndustryConfig(activeMembership.industry);
  const form=<ServiceForm automotivePricing={config.key==="automotive"} serviceLabel={config.terminology.service} idPrefix={config.key==="salon"?"salon-treatment":"service"} categories={categories??[]} branches={branches??[]} services={services??[]} error={params.error}/>;
  if(config.key==="salon") return <main id="salon-treatment-create-page"><FormDialog id="salon-treatment-create-dialog" title="Add treatment" closeHref="/dashboard/services" size="xl">{form}</FormDialog></main>;
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-brand-primary">{config.terminology.service}s</p><h1 className="mt-1 text-3xl font-black">Add {config.terminology.service.toLowerCase()}</h1><div className="mt-6">{form}</div></div>;
}
