import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingForm } from "@/app/shop/[slug]/book/booking-form";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/operations";
import { buildPublicBookingCalendar, selectPublicBookingDate } from "@/lib/public-booking-calendar";
import { publicBookingDate, type PublicShop } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";

const selectClass = "mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-white px-3 text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-primary";
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AvailabilityDate = { available_date: string; slot_count: number };

function bookingHref(slug: string, branchId: string, serviceIds: readonly string[], values: { month?: string; date?: string }) {
  const query = new URLSearchParams({ branch: branchId });
  serviceIds.forEach(serviceId => query.append("services", serviceId));
  if (values.month) query.set("month", values.month);
  if (values.date) query.set("date", values.date);
  return `/shop/${encodeURIComponent(slug)}/book?${query}`;
}

function missingRpc(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

async function loadAvailabilityDates(supabase: SupabaseClient, input: { slug: string; branchId: string; serviceIds: string[]; start: string; end: string; dates: string[] }) {
  const range = await supabase.rpc("get_public_availability_dates_for_services", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_ids: input.serviceIds,
    p_start_date: input.start,
    p_end_date: input.end,
  });

  if (!range.error) {
    return { dates: ((range.data ?? []) as AvailabilityDate[]).map(row => row.available_date), error: false, upgradeRequired: false };
  }

  if (!missingRpc(range.error)) return { dates: [], error: true, upgradeRequired: false };
  // Existing single-service storefronts remain available during migration rollout.
  if (input.serviceIds.length !== 1) return { dates: [], error: true, upgradeRequired: true };
  const legacyRange = await supabase.rpc("get_public_availability_dates", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_id: input.serviceIds[0],
    p_start_date: input.start,
    p_end_date: input.end,
  });
  if (!legacyRange.error) return { dates: ((legacyRange.data ?? []) as AvailabilityDate[]).map(row => row.available_date), error: false, upgradeRequired: false };
  if (!missingRpc(legacyRange.error)) return { dates: [], error: true, upgradeRequired: false };
  const daily = await Promise.all(input.dates.map(async date => {
    const result = await supabase.rpc("get_public_availability", {
      p_slug: input.slug,
      p_branch_id: input.branchId,
      p_service_id: input.serviceIds[0],
      p_date: date,
    });
    return { date, available: !result.error && Boolean(result.data?.length), error: Boolean(result.error) };
  }));
  return { dates: daily.filter(day => day.available).map(day => day.date), error: daily.some(day => day.error), upgradeRequired: false };
}

async function loadSlots(supabase: SupabaseClient, input: { slug: string; branchId: string; serviceIds: string[]; date: string }) {
  const result = await supabase.rpc("get_public_availability_for_services", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_ids: input.serviceIds,
    p_date: input.date,
  });
  if (!result.error) return { slots: (result.data ?? []) as Array<{ slot_at: string }>, error: false, upgradeRequired: false };
  if (!missingRpc(result.error) || input.serviceIds.length !== 1) return { slots: [], error: true, upgradeRequired: missingRpc(result.error) };
  const legacy = await supabase.rpc("get_public_availability", {
    p_slug: input.slug,
    p_branch_id: input.branchId,
    p_service_id: input.serviceIds[0],
    p_date: input.date,
  });
  return { slots: (legacy.data ?? []) as Array<{ slot_at: string }>, error: Boolean(legacy.error), upgradeRequired: false };
}

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ branch?: string; service?: string; services?: string | string[]; selection?: string; month?: string; date?: string; error?: string }> }) {
  const [{ slug }, parameters, supabase] = await Promise.all([params, searchParams, createClient()]);
  const { data } = await supabase.rpc("get_public_shop", { p_slug: slug });
  const shop = data as PublicShop | null;
  if (!shop) notFound();

  const bookingBranches = shop.branches.filter(item => item.acceptsBookings);
  const branch = bookingBranches.find(item => item.id === parameters.branch) ?? bookingBranches[0];
  const hasPublicServices = shop.services.length > 0;
  const requestedServiceIds = Array.isArray(parameters.services)
    ? parameters.services
    : parameters.services ? [parameters.services] : parameters.service ? [parameters.service] : [];
  const requestedServiceSet = new Set(requestedServiceIds);
  const selectedServices = shop.services.filter(item => requestedServiceSet.has(item.id));
  const explicitEmptySelection = parameters.selection === "1" && !selectedServices.length;
  if (!selectedServices.length && !explicitEmptySelection && shop.services[0]) selectedServices.push(shop.services[0]);
  const selectedServiceIds = selectedServices.map(item => item.id);
  const selectedDurationMinutes = selectedServices.reduce((total, item) => total + item.durationMinutes, 0);
  const selectedPriceCentavos = selectedServices.reduce((total, item) => total + item.priceCentavos, 0);
  const tooManyServices = selectedServices.length > 10;
  const { today, maxDate } = publicBookingDate(undefined, branch?.timezone ?? "Asia/Manila");
  const calendar = buildPublicBookingCalendar(parameters.month ?? parameters.date?.slice(0, 7), today, maxDate);
  const calendarDates = calendar.days.filter(day => day.inMonth && day.inBookingWindow).map(day => day.date);

  let availabilityError = false;
  let availabilityUpgradeRequired = false;
  let availableDates: string[] = [];
  if (branch && selectedServiceIds.length && !tooManyServices) {
    const availability = await loadAvailabilityDates(supabase, {
      slug,
      branchId: branch.id,
      serviceIds: selectedServiceIds,
      start: calendar.queryStart,
      end: calendar.queryEnd,
      dates: calendarDates,
    });
    availabilityError = availability.error;
    availabilityUpgradeRequired = availability.upgradeRequired;
    availableDates = availability.dates;
  }

  const selectedDate = selectPublicBookingDate(parameters.date, availableDates);
  let slots: Array<{ slot_at: string }> = [];
  if (!availabilityError && branch && selectedServiceIds.length && selectedDate) {
    const result = await loadSlots(supabase, { slug, branchId: branch.id, serviceIds: selectedServiceIds, date: selectedDate });
    availabilityError = result.error;
    availabilityUpgradeRequired = result.upgradeRequired;
    slots = result.slots;
  }

  const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeZone: "UTC" });

  return <main id="public-booking-page" className="min-h-dvh bg-admin-canvas text-admin-text">
    <header id="public-booking-header" className="border-b border-admin-border bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link id="public-booking-back-link" href={`/shop/${encodeURIComponent(slug)}`} className="flex min-w-0 items-center gap-1 font-semibold text-brand-ink hover:text-brand-primary"><span aria-hidden="true">←</span><span className="truncate">{shop.name}</span></Link>
        <span className="hidden text-sm text-admin-text-muted sm:block">Secure booking request</span>
      </div>
    </header>

    <div className="mx-auto min-w-0 max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-brand-primary-strong">Online booking</p>
        <h1 id="public-booking-title" className="mt-2 text-3xl font-semibold tracking-tight text-brand-ink sm:text-4xl">Choose your preferred visit</h1>
        <p className="mt-3 text-admin-text-secondary">See available dates first, then select a time and tell {shop.name} how to contact you. Your request is confirmed after the business reviews it.</p>
      </div>
      <FormMessage error={parameters.error}/>

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Card id="public-booking-service-section" elevation="none" className="p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-ui-md bg-brand-tint text-brand-primary-strong"><MapPin aria-hidden="true" size={19}/></span><div><p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Step 1</p><h2 className="mt-0.5 text-lg font-semibold">Choose location and {shop.industry === "salon" ? "treatments" : "services"}</h2><p className="mt-1 text-sm text-admin-text-muted">Select up to 10. Availability uses their combined duration.</p></div></div>
            {!hasPublicServices ? <p id="public-booking-no-services" className="mt-4 rounded-ui-md border border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning">No services are currently published for online booking. Please contact {shop.name} directly.</p> : !branch ? <p id="public-booking-no-branches" className="mt-4 text-sm text-admin-text-secondary">No locations are currently accepting online requests. Please contact {shop.name} directly.</p> : <form id="public-booking-availability-form" className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">Location<select id="public-booking-branch-select" className={selectClass} name="branch" defaultValue={branch.id}>{bookingBranches.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <fieldset id="public-booking-service-options" className="sm:col-span-2"><legend className="text-sm font-semibold">{shop.industry === "salon" ? "Treatments" : "Services"}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{shop.services.map(item => <label id={`public-booking-service-option-${item.id}`} key={item.id} className="flex cursor-pointer items-start gap-3 rounded-ui-md border border-admin-border bg-white p-3 transition-colors has-[:checked]:border-brand-primary has-[:checked]:bg-brand-tint has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary"><input id={`public-booking-service-${item.id}`} type="checkbox" name="services" value={item.id} defaultChecked={selectedServiceIds.includes(item.id)} className="mt-1 size-4 shrink-0 accent-[var(--brand-primary)]"/><span className="min-w-0"><strong className="block text-sm">{item.name}</strong><small className="mt-0.5 block text-admin-text-muted">{item.durationMinutes} min · from {formatMoney(item.priceCentavos)}</small></span></label>)}</div>{selectedServices.length ? <p id="public-booking-service-selection-summary" className="mt-3 text-sm font-medium text-admin-text-secondary">{selectedServices.length} selected · {selectedDurationMinutes} min · from {formatMoney(selectedPriceCentavos)}</p> : null}</fieldset>
              <input type="hidden" name="selection" value="1"/>
              <input type="hidden" name="month" value={calendar.month}/>
              {explicitEmptySelection ? <p id="public-booking-service-required-error" role="alert" className="text-sm text-status-danger sm:col-span-2">Select at least one {shop.industry === "salon" ? "treatment" : "service"}.</p> : null}
              {tooManyServices ? <p id="public-booking-service-limit-error" role="alert" className="text-sm text-status-danger sm:col-span-2">Select no more than 10 {shop.industry === "salon" ? "treatments" : "services"}.</p> : null}
              <Button id="public-booking-show-availability-button" className="sm:col-span-2 sm:justify-self-start" variant="secondary" type="submit">Update availability</Button>
            </form>}
          </Card>

          {hasPublicServices && branch && selectedServiceIds.length && !tooManyServices ? <Card id="public-booking-calendar-section" elevation="none" className="overflow-hidden">
            <div className="flex items-start gap-3 border-b border-admin-border p-4 sm:p-5"><span className="grid size-10 shrink-0 place-items-center rounded-ui-md bg-brand-tint text-brand-primary-strong"><CalendarDays aria-hidden="true" size={19}/></span><div><p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Step 2</p><h2 className="mt-0.5 text-lg font-semibold">Select an available date</h2><p className="mt-1 text-sm text-admin-text-muted">Highlighted dates have at least one opening.</p></div></div>
            <div className="p-3 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                {calendar.previousMonth ? <Button id="public-booking-previous-month" asChild variant="ghost" size="icon"><Link prefetch={false} aria-label="Previous month" href={bookingHref(slug, branch.id, selectedServiceIds, { month: calendar.previousMonth })}><ChevronLeft aria-hidden="true" size={20}/></Link></Button> : <span className="size-11"/>}
                <h3 id="public-booking-calendar-month" className="font-semibold">{calendar.label}</h3>
                {calendar.nextMonth ? <Button id="public-booking-next-month" asChild variant="ghost" size="icon"><Link prefetch={false} aria-label="Next month" href={bookingHref(slug, branch.id, selectedServiceIds, { month: calendar.nextMonth })}><ChevronRight aria-hidden="true" size={20}/></Link></Button> : <span className="size-11"/>}
              </div>
              <div id="public-booking-calendar" className="mt-2 grid grid-cols-7 gap-1" aria-labelledby="public-booking-calendar-month">
                {weekdayLabels.map(day => <div className="py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-admin-text-muted" key={day}>{day}</div>)}
                {calendar.days.map(day => {
                  const available = day.inMonth && availableDates.includes(day.date);
                  const selected = day.date === selectedDate;
                  if (!day.inMonth) return <span aria-hidden="true" className="aspect-square" key={day.date}/>;
                  const formattedDate = dateFormatter.format(new Date(`${day.date}T12:00:00Z`));
                  return available ? <Link prefetch={false} id={`public-booking-date-${day.date}`} key={day.date} href={`${bookingHref(slug, branch.id, selectedServiceIds, { month: calendar.month, date: day.date })}#public-booking-details-section`} aria-current={selected ? "date" : undefined} aria-label={`${formattedDate}, available`} className={`grid aspect-square min-h-10 place-items-center rounded-ui-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${selected ? "bg-brand-primary text-white shadow-ui-sm" : "bg-brand-tint text-brand-primary-strong hover:bg-brand-border"}`}>{day.dayNumber}</Link> : <span id={`public-booking-date-${day.date}`} key={day.date} aria-disabled="true" aria-label={`${formattedDate}, unavailable`} className={`grid aspect-square min-h-10 place-items-center rounded-ui-md text-sm ${day.inBookingWindow ? "text-admin-text-muted" : "text-slate-300"}`}>{day.dayNumber}</span>;
                })}
              </div>
              {availabilityError ? <p id="public-booking-availability-error" role="alert" className="mt-4 rounded-ui-md bg-status-warning-tint p-3 text-sm text-status-warning">{availabilityUpgradeRequired ? "Multi-service booking availability is being updated. Please try again shortly or select one service." : "Availability could not be loaded. Please try again shortly or contact the business."}</p> : !availableDates.length ? <p id="public-booking-no-openings" className="mt-4 rounded-ui-md border border-admin-border bg-admin-surface-muted p-4 text-sm text-admin-text-secondary">No openings remain in {calendar.label}. Try another month or contact the business.</p> : null}
            </div>
          </Card> : null}

          <Card id="public-booking-details-section" elevation="none" className="p-4 sm:p-5">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-ui-md bg-brand-tint text-brand-primary-strong"><Clock3 aria-hidden="true" size={19}/></span><div><p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Step 3</p><h2 className="mt-0.5 text-lg font-semibold">Select a time and complete your details</h2></div></div>
            {!hasPublicServices ? <p id="public-booking-request-unavailable" className="mt-4 text-sm text-admin-text-secondary">Booking requests will become available when the business publishes a service.</p> : !branch || !selectedServices.length ? <p id="public-booking-branch-unavailable" className="mt-4 text-sm text-admin-text-secondary">Choose at least one service and update availability to continue.</p> : availabilityError ? <p className="mt-4 text-sm text-admin-text-secondary">Details will become available after openings load.</p> : !selectedDate || !slots.length ? <p className="mt-4 text-sm text-admin-text-secondary">Choose an available date above to continue.</p> : <BookingForm key={`${branch.id}-${selectedServiceIds.join("-")}-${selectedDate}`} slug={slug} industry={shop.industry ?? "automotive"} branch={branch} services={selectedServices} selectedDate={selectedDate} slots={slots}/>}
          </Card>
        </div>

        <aside id="public-booking-summary" className="hidden lg:sticky lg:top-5 lg:block">
          <Card elevation="none" className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Your request</p><h2 className="mt-1 text-lg font-semibold">{shop.name}</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-admin-text-muted">Location</dt><dd className="mt-0.5 font-medium">{branch?.name ?? "Not available"}</dd></div><div><dt className="text-admin-text-muted">{shop.industry === "salon" ? "Treatments" : "Services"}</dt><dd className="mt-1"><ul className="space-y-1 font-medium">{selectedServices.map(item => <li key={item.id}>{item.name}</li>)}</ul>{!selectedServices.length ? "Choose at least one" : null}</dd></div><div><dt className="text-admin-text-muted">Date</dt><dd className="mt-0.5 font-medium">{selectedDate ? dateFormatter.format(new Date(`${selectedDate}T12:00:00Z`)) : "Choose an available date"}</dd></div></dl><p className="mt-5 border-t border-admin-border pt-4 text-xs leading-5 text-admin-text-muted">Submitting sends a request. The business will confirm the final appointment time.</p></Card>
        </aside>
      </div>
    </div>
  </main>;
}
