"use client";

import { startTransition, useActionState, useState, type ChangeEvent } from "react";

import { submitBooking } from "@/app/shop/[slug]/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicBranch, PublicService, PublicShop } from "@/lib/public-booking";

export function BookingForm({ slug, industry, branch, services, selectedDate, slots }: { slug: string; industry: PublicShop["industry"]; branch: PublicBranch; services: PublicService[]; selectedDate: string; slots: Array<{ slot_at: string }> }) {
  const [state, action, pending] = useActionState(submitBooking, {});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const selectedTime = draft.preferredAt ?? state.values?.preferredAt ?? slots[0]?.slot_at ?? "";
  const fieldValue = (name: string) => draft[name] ?? state.values?.[name] ?? "";
  const updateDraft = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.currentTarget;
    setDraft(previous => ({ ...previous, [name]: value }));
  };
  const timeFormatter = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: branch.timezone ?? "Asia/Manila" });
  const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" });

  return <form id="public-booking-request-form" action={action} onSubmit={event => {
    // Dispatch explicitly so a rejected request preserves every entered field.
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }} className="mt-5" aria-busy={pending}>
    <fieldset disabled={pending}>
      <FormMessage error={state.error}/>
      <input type="hidden" name="slug" value={slug}/>
      <input type="hidden" name="branchId" value={branch.id}/>
      {services.map(service => <input key={service.id} type="hidden" name="serviceIds" value={service.id}/>)}

      <section id="public-booking-time-section" aria-labelledby="public-booking-time-title">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 id="public-booking-time-title" className="font-semibold">Available times</h3><p className="mt-1 text-sm text-admin-text-muted">{dateFormatter.format(new Date(`${selectedDate}T12:00:00Z`))} · {branch.name} · {services.length} {services.length === 1 ? (industry === "salon" ? "treatment" : "service") : (industry === "salon" ? "treatments" : "services")}</p></div><span className="text-xs text-admin-text-muted">{branch.timezone.replaceAll("_", " ")}</span></div>
        <div id="public-booking-time-options" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {slots.map((slot, index) => <label id={`public-booking-time-option-${index}`} key={slot.slot_at} className="cursor-pointer rounded-ui-md border border-admin-border bg-white text-center transition-colors has-[:checked]:border-brand-primary has-[:checked]:bg-brand-tint has-[:checked]:text-brand-primary-strong has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary has-[:focus-visible]:ring-offset-2">
            <input id={`public-booking-time-${index}`} className="sr-only" required type="radio" name="preferredAt" value={slot.slot_at} checked={selectedTime === slot.slot_at} onChange={updateDraft}/>
            <span className="flex min-h-11 items-center justify-center px-2 py-2 text-sm font-semibold">{timeFormatter.format(new Date(slot.slot_at))}</span>
          </label>)}
        </div>
      </section>

      <section id="public-booking-customer-section" className="mt-7 border-t border-admin-border pt-5" aria-labelledby="public-booking-customer-title">
        <h3 id="public-booking-customer-title" className="font-semibold">Your contact details</h3>
        <p className="mt-1 text-sm text-admin-text-muted">The business will use these details to confirm your request.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Full name<Input id="public-booking-name-input" required name="customerName" value={fieldValue("customerName")} onChange={updateDraft} autoComplete="name" className="mt-2"/></label>
          <label className="text-sm font-semibold">Mobile number<Input id="public-booking-phone-input" required name="phone" value={fieldValue("phone")} onChange={updateDraft} autoComplete="tel" inputMode="tel" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Email <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-email-input" name="email" value={fieldValue("email")} onChange={updateDraft} type="email" autoComplete="email" className="mt-2"/></label>
        </div>
      </section>

      {industry === "automotive" ? <section id="public-booking-vehicle-section" className="mt-7 border-t border-admin-border pt-5" aria-labelledby="public-booking-vehicle-title">
        <h3 id="public-booking-vehicle-title" className="font-semibold">Vehicle details</h3>
        <p className="mt-1 text-sm text-admin-text-muted">Tell the shop which vehicle needs service.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Vehicle make<Input id="public-booking-vehicle-make-input" required name="vehicleMake" value={fieldValue("vehicleMake")} onChange={updateDraft} placeholder="Toyota" autoComplete="off" className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle model<Input id="public-booking-vehicle-model-input" required name="vehicleModel" value={fieldValue("vehicleModel")} onChange={updateDraft} placeholder="Fortuner" autoComplete="off" className="mt-2"/></label>
          <label className="text-sm font-semibold">Model year <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-vehicle-year-input" name="vehicleYear" value={fieldValue("vehicleYear")} onChange={updateDraft} type="number" inputMode="numeric" min="1900" max={new Date().getFullYear() + 1} className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle type <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-vehicle-type-input" name="vehicleType" value={fieldValue("vehicleType")} onChange={updateDraft} placeholder="SUV" autoComplete="off" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Plate number <span className="font-normal text-admin-text-muted">(optional)</span><Input id="public-booking-plate-input" name="plateNumber" value={fieldValue("plateNumber")} onChange={updateDraft} autoComplete="off" className="mt-2"/></label>
        </div>
      </section> : null}

      <section id="public-booking-notes-section" className="mt-7 border-t border-admin-border pt-5">
        <label className="text-sm font-semibold">Anything the business should know? <span className="font-normal text-admin-text-muted">(optional)</span><textarea id="public-booking-notes-input" name="customerNote" value={fieldValue("customerNote")} onChange={updateDraft} maxLength={1000} className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border bg-white p-3 focus:outline-none focus:ring-2 focus:ring-brand-primary"/></label>
      </section>

      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      <div className="mt-5 rounded-ui-md bg-admin-surface-muted p-4"><p className="text-xs leading-5 text-admin-text-muted">Your selected time is a request until {branch.name} confirms it. Availability is checked again when you submit.</p><Button id="public-booking-submit-button" className="mt-3 w-full" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Submitting request…" : "Submit booking request"}</Button></div>
    </fieldset>
  </form>;
}
