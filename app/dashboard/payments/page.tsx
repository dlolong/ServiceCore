import Link from "next/link";
import { PageHeader } from "@/components/page-patterns";
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
  return <main id="payments-page" className="mx-auto min-w-0 max-w-6xl">
    <PageHeader id="payments-page-header" eyebrow={activeMembership.branchName} title="Payments" description="Daily cashier summary and outstanding balances."/>
    <section id="payments-metrics" aria-label="Payment summary" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card id="payments-collected-today" elevation="none" className="p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Collected today</p><strong className="mt-1 block text-xl text-admin-text sm:text-2xl">{formatMoney(collected)}</strong></Card>
      <Card id="payments-count-today" elevation="none" className="p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment count</p><strong className="mt-1 block text-xl text-admin-text sm:text-2xl">{paid.length}</strong></Card>
      <Card id="payments-outstanding-total" elevation="none" className="col-span-2 p-4 sm:col-span-1 sm:p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Outstanding</p><strong className="mt-1 block text-xl text-admin-text sm:text-2xl">{formatMoney(outstanding)}</strong></Card>
    </section>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <section id="payments-by-method" className="rounded-ui-lg border border-admin-border bg-white p-5"><h2 className="font-semibold text-admin-text">By payment method</h2><div className="mt-3 divide-y divide-slate-100">{byMethod.map(([method, total]) => <div id={`payments-method-${method}`} className="flex justify-between py-3 text-sm capitalize" key={method}><span>{method.replaceAll("_", " ")}</span><strong>{formatMoney(total)}</strong></div>)}{!byMethod.length && <p id="payments-by-method-empty" className="py-6 text-sm text-zinc-500">No payments today.</p>}</div></section>
      <section id="payments-outstanding-invoices" className="rounded-ui-lg border border-admin-border bg-white p-5"><h2 className="font-semibold text-admin-text">Outstanding invoices</h2><div className="mt-3 divide-y divide-slate-100">{invoices?.map(invoice => <Link id={`payments-invoice-${invoice.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3 text-admin-text hover:text-brand-primary-strong" href={`/dashboard/invoices/${invoice.id}`} key={invoice.id}><span className="min-w-0"><strong>{invoice.invoice_number}</strong><small className="block truncate text-zinc-500">{invoice.customer_name_snapshot}</small></span><strong className="shrink-0">{formatMoney(invoice.balance_centavos)}</strong></Link>)}{!invoices?.length && <p id="payments-outstanding-empty" className="py-6 text-sm text-zinc-500">No outstanding invoices.</p>}</div></section>
    </div>
  </main>;
}
