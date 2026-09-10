"use client";
import { useActionState, useState, startTransition, type ChangeEvent } from "react";
import { submitBooking } from "@/app/shop/[slug]/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicBranch, PublicService, PublicShop } from "@/lib/public-booking";
const select = "mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-white px-3 text-admin-text";
export function BookingForm({ slug, industry, branch, service, slots }: { slug: string; industry: PublicShop["industry"]; branch: PublicBranch; service: PublicService; slots: Array<{ slot_at: string }> }) {
 const [state, action, pending] = useActionState(submitBooking, {});
 const [draft, setDraft] = useState<Record<string, string>>({});
 const updateDraft = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
   const { name, value } = event.currentTarget;
   setDraft(previous => ({ ...previous, [name]: value }));
 };
 return <form id="public-booking-request-form" action={action} onSubmit={event => {
   // React resets native select elements after a resolved form action, including validation failures.
   // Dispatch explicitly after hydration so a failed request keeps the visitor's selected time.
   event.preventDefault();
   const data = new FormData(event.currentTarget);
   startTransition(() => action(data));
 }} className="mt-4 grid gap-4 sm:grid-cols-2" aria-busy={pending}>
          <fieldset disabled={pending} className="contents">
          <FormMessage error={state.error}/>
          <input type="hidden" name="slug" value={slug}/><input type="hidden" name="branchId" value={branch.id}/><input type="hidden" name="serviceIds" value={service.id}/>
          <label className="text-sm font-semibold sm:col-span-2">Preferred time<select id="public-booking-time-select" required className={select} name="preferredAt" value={draft.preferredAt ?? slots[0]?.slot_at ?? ""} onChange={updateDraft}>{slots.map((slot) => <option value={slot.slot_at} key={slot.slot_at}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: branch.timezone ?? "Asia/Manila" }).format(new Date(slot.slot_at))}</option>)}</select></label>
          <label className="text-sm font-semibold">Full name<Input id="public-booking-name-input" required name="customerName" value={draft.customerName ?? ""} onChange={updateDraft} autoComplete="name" className="mt-2"/></label>
          <label className="text-sm font-semibold">Mobile number<Input id="public-booking-phone-input" required name="phone" value={draft.phone ?? ""} onChange={updateDraft} autoComplete="tel" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Email <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-email-input" name="email" value={draft.email ?? ""} onChange={updateDraft} type="email" autoComplete="email" className="mt-2"/></label>
          {industry === "automotive" && <>
          <label className="text-sm font-semibold">Vehicle make<Input id="public-booking-vehicle-make-input" required name="vehicleMake" value={draft.vehicleMake ?? ""} onChange={updateDraft} placeholder="Toyota" className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle model<Input id="public-booking-vehicle-model-input" required name="vehicleModel" value={draft.vehicleModel ?? ""} onChange={updateDraft} placeholder="Fortuner" className="mt-2"/></label>
          <label className="text-sm font-semibold">Model year <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-vehicle-year-input" name="vehicleYear" value={draft.vehicleYear ?? ""} onChange={updateDraft} type="number" min="1900" max={new Date().getFullYear() + 1} className="mt-2"/></label>
          <label className="text-sm font-semibold">Vehicle type <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-vehicle-type-input" name="vehicleType" value={draft.vehicleType ?? ""} onChange={updateDraft} placeholder="SUV" className="mt-2"/></label>
          <label className="text-sm font-semibold sm:col-span-2">Plate number <span className="font-normal text-slate-500">(optional)</span><Input id="public-booking-plate-input" name="plateNumber" value={draft.plateNumber ?? ""} onChange={updateDraft} className="mt-2"/></label>
          </>}
          <label className="text-sm font-semibold sm:col-span-2">Notes <span className="font-normal text-slate-500">(optional)</span><textarea id="public-booking-notes-input" name="customerNote" value={draft.customerNote ?? ""} onChange={updateDraft} maxLength={1000} className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border bg-white p-3"/></label>
          <label className="absolute -left-[9999px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
          <p className="text-xs text-zinc-500 sm:col-span-2">The business will review your request and confirm your appointment.</p>
          <Button id="public-booking-submit-button" className="sm:col-span-2" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Submitting request…" : "Submit booking request"}</Button>
          </fieldset>
        </form>;
}
