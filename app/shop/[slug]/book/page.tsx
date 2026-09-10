import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingForm } from "@/app/shop/[slug]/book/booking-form";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { publicBookingDate, type PublicShop } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";

const select = "mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-white px-3 text-admin-text";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ branch?: string; service?: string; date?: string; error?: string }> }) {
  const [{ slug }, parameters, supabase] = await Promise.all([params, searchParams, createClient()]);
  const { data } = await supabase.rpc("get_public_shop", { p_slug: slug });
  const shop = data as PublicShop | null;
  if (!shop) notFound();
  const branch = shop.branches.find((item) => item.id === parameters.branch && item.acceptsBookings) ?? shop.branches.find((item) => item.acceptsBookings);
  const service = shop.services.find((item) => item.id === parameters.service) ?? shop.services[0];
  const hasPublicServices = shop.services.length > 0;
  const { date, today, maxDate } = publicBookingDate(parameters.date, branch?.timezone ?? "Asia/Manila");
  let availabilityError = false;
  let slots: Array<{ slot_at: string }> = [];
  if (branch && service) {
    const { data: available, error: slotError } = await supabase.rpc("get_public_availability", { p_slug: slug, p_branch_id: branch.id, p_service_id: service.id, p_date: date });
    availabilityError = Boolean(slotError);
    slots = available ?? [];
  }

  return <main id="public-booking-page" className="min-h-dvh bg-slate-50 px-4 py-6 sm:px-5 sm:py-10">
    <div className="mx-auto min-w-0 max-w-3xl">
      <Link id="public-booking-back-link" href={`/shop/${slug}`} className="font-bold text-brand-primary-strong">← {shop.name}</Link>
      <h1 id="public-booking-title" className="mt-4 text-3xl font-black text-brand-ink sm:text-4xl">Request a booking</h1>
      <p className="mt-2 text-zinc-600">Choose a preferred opening. The business will review and confirm your request.</p>
      <FormMessage error={parameters.error}/>

      <Card id="public-booking-availability-section" elevation="none" className="mt-6 p-5"><h2 className="font-black">1. Branch, {shop.industry === "salon" ? "treatment" : "service"}, and date</h2>
        {!hasPublicServices ? <p id="public-booking-no-services" className="mt-4 rounded-xl border border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning">No services are currently published for online booking. Please contact {shop.name} directly for assistance.</p> : !branch ? <p id="public-booking-no-branches" className="mt-4 text-sm text-zinc-600">No branches are accepting online requests. Please contact {shop.name} directly.</p> : <form id="public-booking-availability-form" className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-semibold">Branch<select id="public-booking-branch-select" className={select} name="branch" defaultValue={branch?.id}>{shop.branches.filter((item) => item.acceptsBookings).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-semibold">{shop.industry === "salon" ? "Treatment" : "Service"}<select id="public-booking-service-select" className={select} name="service" defaultValue={service?.id}>{shop.services.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-semibold">Date<Input id="public-booking-date-input" name="date" type="date" min={today} max={maxDate} defaultValue={date} className="mt-2"/></label>
          <Button id="public-booking-show-openings-button" className="sm:col-span-3" variant="secondary" type="submit">Show openings</Button>
        </form>}
      </Card>

      <Card id="public-booking-details-section" elevation="none" className="mt-5 p-5"><h2 className="font-black">2. {shop.industry === "salon" ? "Contact details" : "Contact and vehicle details"}</h2>
        {!hasPublicServices ? <p id="public-booking-request-unavailable" className="mt-4 text-sm text-zinc-600">Booking requests will become available when the business publishes a service.</p> : !branch ? <p id="public-booking-branch-unavailable" className="mt-4 text-sm text-zinc-600">Please contact the business to arrange your visit.</p> : availabilityError ? <p id="public-booking-availability-error" role="alert" className="mt-4 text-sm text-status-warning">Unable to load openings. Please try again shortly or contact the business.</p> : !slots.length ? <p id="public-booking-no-openings" className="mt-4 rounded-xl border border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning">No openings are available for this date. Try another date.</p> : <BookingForm key={`${branch!.id}-${service!.id}-${date}`} slug={slug} industry={shop.industry ?? "automotive"} branch={branch!} service={service!} slots={slots}/>}
      </Card>
    </div>
  </main>;
}
