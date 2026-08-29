import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { formatMoney, zonedDateTimeToUtc } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const [{ activeMembership }, supabase] = await Promise.all([getDashboardContext(), createClient()]);
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: activeMembership.timezone }).format(new Date()), start = zonedDateTimeToUtc(`${localDate}T00:00`, activeMembership.timezone)!, end = new Date(start.valueOf() + 86400000);
  const [{ data: payments }, { data: invoices }] = await Promise.all([
    supabase.from("payments").select("id,invoice_id,amount_centavos,method,status,reference,paid_at,invoices(invoice_number,customer_name_snapshot)").eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).gte("paid_at", start.toISOString()).lt("paid_at", end.toISOString()).order("paid_at", { ascending: false }),
    supabase.from("invoices").select("id,invoice_number,customer_name_snapshot,total_centavos,balance_centavos,status").eq("organization_id", activeMembership.organizationId).eq("branch_id", activeMembership.branchId).gt("balance_centavos", 0).neq("status", "void").order("issued_at", { ascending: false }).limit(100),
  ]);
  const paid = (payments ?? []).filter(payment => payment.status === "paid");
  const collected = paid.reduce((sum, payment) => sum + payment.amount_centavos, 0);
  const outstanding = (invoices ?? []).reduce((sum, invoice) => sum + invoice.balance_centavos, 0);
  const byMethod = Object.entries(
    paid.reduce<Record<string, number>>((totals, payment) => {
      totals[payment.method] = (totals[payment.method] ?? 0) + payment.amount_centavos;
      return totals;
    }, {}),
  );
  return <div className="mx-auto max-w-6xl"><p className="text-sm font-bold text-amber-700">{activeMembership.branchName}</p><h1 className="text-3xl font-black">Payments</h1><p className="mt-2 text-zinc-600">Daily cashier summary and outstanding balances.</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-sm text-zinc-500">Collected today</p><strong className="mt-2 block text-2xl">{formatMoney(collected)}</strong></Card><Card className="p-5"><p className="text-sm text-zinc-500">Payment count</p><strong className="mt-2 block text-2xl">{paid.length}</strong></Card><Card className="p-5"><p className="text-sm text-zinc-500">Outstanding</p><strong className="mt-2 block text-2xl">{formatMoney(outstanding)}</strong></Card></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><Card className="p-5"><h2 className="font-black">By payment method</h2><div className="mt-3 space-y-2">{byMethod.map(([method, total]) => <div className="flex justify-between border-b py-2 capitalize" key={method}><span>{method.replaceAll("_", " ")}</span><strong>{formatMoney(total)}</strong></div>)}{!byMethod.length && <p className="text-sm text-zinc-500">No payments today.</p>}</div></Card><Card className="p-5"><h2 className="font-black">Outstanding invoices</h2><div className="mt-3 space-y-2">{invoices?.map(invoice => <Link className="flex justify-between rounded-xl border p-3" href={`/dashboard/invoices/${invoice.id}`} key={invoice.id}><span><strong>{invoice.invoice_number}</strong><small className="block text-zinc-500">{invoice.customer_name_snapshot}</small></span><strong>{formatMoney(invoice.balance_centavos)}</strong></Link>)}{!invoices?.length && <p className="text-sm text-zinc-500">No outstanding invoices.</p>}</div></Card></div></div>;
}
