import { ServiceForm } from "@/components/operations-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function Page({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const [params,{activeMembership},supabase]=await Promise.all([searchParams,getDashboardContext(),createClient()]);
  const [{data:categories},{data:branches},{data:services}]=await Promise.all([
    supabase.from("service_categories").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("branches").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).order("name"),
    supabase.from("services").select("id,name").eq("organization_id",activeMembership.organizationId).eq("is_active",true).eq("is_add_on",false).order("name"),
  ]);
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-amber-700">Services</p><h1 className="mt-1 text-3xl font-black">Add service</h1><div className="mt-6"><ServiceForm categories={categories??[]} branches={branches??[]} services={services??[]} error={params.error}/></div></div>;
}
