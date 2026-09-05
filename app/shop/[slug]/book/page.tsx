/* eslint-disable react-hooks/purity -- server-rendered availability intentionally uses the current request time. */
import Link from "next/link";
import { notFound } from "next/navigation";

import { submitBooking } from "@/app/shop/[slug]/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PublicShop } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";

const select = "mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-white px-3 text-admin-text";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ branch?: string; service?: string; date?: string; error?: string }> }) {
  const [{ slug }, parameters, supabase] = await Promise.all([params, searchParams, createClient()]);
  const { data } = await supabase.rpc("get_public_shop", { p_slug: slug });
  const shop = data as PublicShop | null;
  if (!shop) notFound();
  const branch = shop.branches.find((item) => item.id === parameters.branch && item.acceptsBookings) ?? shop.branches.find((item) => item.acceptsBookings);
  const service = shop.services.find((item) => item.id === parameters.service) ?? shop.services[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(parameters.date ?? "") ? parameters.date! : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let slots: Array<{ slot_at: string }> = [];
  if (branch && service) {
    const { data: available } = await supabase.rpc("get_public_availability", { p_slug: slug, p_branch_id: branch.id, p_service_id: service.id, p_date: date });
    slots = available ?? [];
  }

  return <main id="public-booking-page" className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-5 sm:py-10">
    <div className="mx-auto min-w-0 max-w-3xl">
      <Link id="public-booking-back-link" href={`/shop/${slug}`} className="font-bold text-brand-primary-strong">← {shop.name}</Link>
      <h1 id="public-booking-title" className="mt-4 text-3xl font-black text-brand-ink sm:text-4xl">Request a booking</h1>
      <p className="mt-2 text-zinc-600">Choose a preferred opening. The shop will review and confirm your request.</p>
      <FormMessage error={parameters.error}/>

      <Card id="public-booking-availability-section" elevation="none" className="mt-6 p-5"><h2 className="font-black">1. Branch, service, and date</h2>
        <form id="public-booking-availability-form" className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">Branch<select id="public-booking-branch-select" className={select} name="branch" defaultValue={branch?.id}>{shop.branches.filter((item) => item.acceptsBookings).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Service<select id="public-booking-service-select" className={select} name="service" defaultValue={service?.id}>{shop.services.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Date<Input id="public-booking-date-input" name="date" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={date} className="mt-2"/></label>
          <Button id="public-booking-show-openings-button" className="sm:col-span-3" variant="secondary" type="submit">Show openings</Button>
        </form>
      </Card>

      <Card id="public-booking-details-section" elevation="none" className="mt-5 p-5"><h2 className="font-black">2. Contact and vehicle details</h2>
        {!slots.length ? <p id="public-booking-no-openings" className="mt-4 rounded-xl border border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning">No safe openings are available for this date. Try another date.</p> : <form id="public-booking-request-form" action={submitBooking} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="slug" value={slug}/><input type="hidden" name="branchId" value={branch?.id}/><input type="hidden" name="serviceIds" value={service?.id}/>
          <label className="text-sm font-semibold sm:col-span-2">Preferred time<select id="public-booking-time-select" required className={select} name="preferredAt">{slots.map((slot) => <option value={slot.slot_at} key={slot.slot_at}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(slot.slot_at))}</option>)}</select></label>
          <label className="text-sm font-semibold">Full name<Input id="public-booking-name-input" required name="customerName" autoComplete="name" className="mt-2"/></label>
          <label className="text-sm font-semibold">Mobile number<Input id="public-booking-phone-input" required name="phone" autoComplete="tel" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Email <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-email-input" name="email" type="email" autoComplete="email" className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle make<Input id="public-booking-vehicle-make-input" required name="vehicleMake" placeholder="Toyota" className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle model<Input id="public-booking-vehicle-model-input" required name="vehicleModel" placeholder="Fortuner" className="mt-2"/></label>
          <label className="text-sm font-semibold">Model year <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-vehicle-year-input" name="vehicleYear" type="number" min="1900" max={new Date().getFullYear() + 1} className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle type <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-vehicle-type-input" name="vehicleType" placeholder="SUV" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Plate number <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-plate-input" name="plateNumber" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Notes <span className="font-normal text-slate-500">(optional)</span><textarea id="public-booking-notes-input" name="customerNote" maxLength={1000} className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border bg-white p-3"/></label>
          <label className="absolute -left-[9999px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
          <p className="text-xs text-zinc-500 sm:col-span-2">Submitting does not reveal whether your details already exist. This is a request, not an automatic confirmation.</p>
          <SubmitButton id="public-booking-submit-button" className="sm:col-span-2" pendingText="Submitting request…">Submit booking request</SubmitButton>
        </form>}
      </Card>
    </div>
  </main>;
}
