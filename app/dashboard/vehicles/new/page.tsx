import { Button } from "@/components/ui/button";
import { VehicleForm } from "@/components/crm-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ searchParams }: { searchParams: Promise<{ customerId?: string; customerQ?: string; error?: string; warning?: string; duplicateId?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const customerQ = params.customerQ?.trim().replace(/[,%()]/g, " ").slice(0, 100);
  let query = supabase.from("customers").select("id,full_name").eq("organization_id", activeMembership.organizationId).eq("is_archived", false).order("full_name").limit(100);
  if (customerQ) query = query.or(`full_name.ilike.%${customerQ}%,phone.ilike.%${customerQ}%,email.ilike.%${customerQ}%`);
  const { data } = await query;
  return <div className="mx-auto max-w-3xl"><p className="text-sm font-bold text-amber-700">Vehicles</p><h1 className="mt-1 text-3xl font-black">Add vehicle</h1><p className="mt-2 text-zinc-600">Only owner, make, and model are required.</p><form className="mt-5 flex gap-2"><label className="grow"><span className="sr-only">Find a customer</span><input className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-zinc-950" name="customerQ" defaultValue={params.customerQ} placeholder="Find customer by name, mobile, or email"/></label><Button type="submit" variant="secondary">Find</Button></form><div className="mt-6"><VehicleForm customers={data ?? []} presetCustomerId={params.customerId} {...params}/></div></div>;
}
