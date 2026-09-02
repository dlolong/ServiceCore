import { notFound } from "next/navigation";

import { saveCommunicationPreferences } from "@/app/dashboard/reminders/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerCommunicationPreferencesPage({
  params,searchParams,
}:{
  params:Promise<{customerId:string}>;searchParams:Promise<{message?:string;error?:string}>;
}){
  const[{customerId},query,{activeMembership},supabase]=await Promise.all([params,searchParams,getDashboardContext(),createClient()]);
  const[{data:customer},{data:preference}]=await Promise.all([
    supabase.from("customers").select("id,full_name,email,phone").eq("id",customerId).eq("organization_id",activeMembership.organizationId).maybeSingle(),
    supabase.from("customer_communication_preferences").select("email_opt_in,sms_opt_in").eq("customer_id",customerId).eq("organization_id",activeMembership.organizationId).maybeSingle(),
  ]);
  if(!customer)notFound();
  return <main id="customer-communication-preferences-page" className="mx-auto max-w-xl">
    <p className="text-sm font-bold text-amber-700">Customer consent</p>
    <h1 className="text-3xl font-black">{customer.full_name}</h1>
    <p className="mt-2 text-zinc-600">Choose which transactional service updates KarKR may send to this customer.</p>
    <FormMessage {...query}/>
    <Card id="customer-communication-preferences-card" className="mt-6 p-5">
      <form id="customer-communication-preferences-form" action={saveCommunicationPreferences} className="space-y-4">
        <input type="hidden" name="customerId" value={customer.id}/>
        <label className="flex gap-3 rounded-xl border p-4">
          <input id="customer-transactional-email-opt-in" type="checkbox" name="emailOptIn" defaultChecked={preference?.email_opt_in}/>
          <span><strong>Transactional Email</strong><small className="block text-zinc-500">{customer.email||"No email address recorded"}</small></span>
        </label>
        <label className="flex gap-3 rounded-xl border p-4">
          <input id="customer-transactional-sms-opt-in" type="checkbox" name="smsOptIn" defaultChecked={preference?.sms_opt_in}/>
          <span><strong>Transactional SMS</strong><small className="block text-zinc-500">{customer.phone||"No phone number recorded"}</small></span>
        </label>
        <p className="text-xs text-zinc-500">Opt-outs block queued messages when delivery is processed. Provider configuration is managed separately.</p>
        <SubmitButton id="customer-communication-preferences-save-button" pendingText="Saving…">Save preferences</SubmitButton>
      </form>
    </Card>
  </main>;
}
