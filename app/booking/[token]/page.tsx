import { CalendarDays, Check, Clock3, MapPin, Scissors, ShieldCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingStatusRefresh } from "@/app/booking/[token]/booking-status-refresh";
import { BrandWordmark } from "@/components/brand-wordmark";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Booking status",
  robots: { index: false, follow: false, nocache: true },
};

type Status = {
  industry?: "automotive" | "salon";
  timezone?: string;
  reference: string;
  status: string;
  shopName: string;
  shopSlug?: string;
  branchName: string;
  preferredAt: string;
  scheduledAt?: string;
  appointmentStatus?: string | null;
  updatedAt?: string;
  services: string[];
  declineReason: string | null;
};

type CustomerState = {
  label: string;
  heading: string;
  message: string;
  variant: BadgeProps["variant"];
  stage: 1 | 2 | 3;
  terminal: boolean;
};

function customerState(status: Status): CustomerState {
  const appointment = status.appointmentStatus;
  if (status.status === "declined") return { label: "Declined", heading: "The business could not accept this request", message: "Review the response below, then contact the business or submit another booking request.", variant: "danger", stage: 2, terminal: true };
  if (status.status === "cancelled" || appointment === "cancelled") return { label: "Cancelled", heading: "This booking was cancelled", message: "Contact the business if you would like to arrange another schedule.", variant: "danger", stage: 2, terminal: true };
  if (appointment === "no_show") return { label: "Missed", heading: "This appointment was marked as missed", message: "Contact the business if you need to schedule another visit.", variant: "warning", stage: 3, terminal: true };
  if (appointment === "completed") return { label: "Completed", heading: "Your appointment is complete", message: "Thank you for choosing this business.", variant: "success", stage: 3, terminal: true };
  if (["checked_in", "queued", "in_service"].includes(appointment ?? "")) return { label: "In progress", heading: "Your visit is now in progress", message: "The business has checked in your appointment and is handling your selected services.", variant: "info", stage: 3, terminal: false };
  if (status.status === "confirmed") return { label: "Confirmed", heading: "Your booking is confirmed", message: "Your schedule is reserved. Please arrive at the location shown below.", variant: "success", stage: 2, terminal: false };
  return { label: "Awaiting confirmation", heading: "Your booking request was received", message: "The business is reviewing your preferred schedule. This page will update when they respond.", variant: "warning", stage: 1, terminal: false };
}

function TimelineStep({ complete, current, label, description }: { complete: boolean; current: boolean; label: string; description: string }) {
  return <li className="relative flex gap-3 pb-5 last:pb-0">
    <span aria-hidden="true" className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${complete ? "border-status-success bg-status-success text-white" : current ? "border-brand-primary bg-brand-tint text-brand-primary-strong" : "border-admin-border bg-white text-admin-text-muted"}`}>{complete ? <Check size={15}/> : current ? <Clock3 size={14}/> : null}</span>
    <span><strong className="block text-sm">{label}</strong><small className="mt-0.5 block leading-5 text-admin-text-muted">{description}</small></span>
  </li>;
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_booking_status", { p_token: token });
  const status = data as Status | null;
  if (!status) notFound();

  const state = customerState(status);
  const timezone = status.timezone ?? "Asia/Manila";
  const schedule = status.scheduledAt ?? status.preferredAt;
  const scheduleLabel = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(schedule));
  const safeShopSlug = status.shopSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(status.shopSlug) ? status.shopSlug : null;
  const serviceLabel = status.industry === "salon" ? "Treatments" : "Services";

  return <main id="public-booking-status-page" className="min-h-dvh bg-admin-canvas text-admin-text">
    <header id="public-booking-status-header" className="border-b border-admin-border bg-white">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandWordmark className="w-24 sm:w-28"/>
        {safeShopSlug ? <Link id="public-booking-status-shop-link" href={`/shop/${encodeURIComponent(safeShopSlug)}`} className="text-sm font-semibold text-brand-primary-strong hover:text-brand-primary">Visit {status.shopName}</Link> : null}
      </div>
    </header>

    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Card id="public-booking-status-card" elevation="none" className="overflow-hidden">
          <div className="border-b border-admin-border p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-admin-text-muted">Booking {status.reference}</p><Badge id="public-booking-status-badge" className="mt-3" variant={state.variant}>{state.label}</Badge></div><span className={`grid size-11 place-items-center rounded-full ${state.variant === "danger" ? "bg-status-danger-tint text-status-danger" : "bg-brand-tint text-brand-primary-strong"}`}>{state.variant === "danger" ? <X aria-hidden="true" size={21}/> : <ShieldCheck aria-hidden="true" size={21}/>}</span></div>
            <h1 id="public-booking-status-title" className="mt-4 text-2xl font-semibold tracking-tight text-brand-ink sm:text-3xl">{state.heading}</h1>
            <p className="mt-2 max-w-2xl text-admin-text-secondary">{state.message}</p>
          </div>

          <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-2">
            <section id="public-booking-status-details" aria-labelledby="public-booking-details-title">
              <h2 id="public-booking-details-title" className="font-semibold">Booking details</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex gap-3"><CalendarDays aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={18}/><div><dt className="text-admin-text-muted">{status.status === "confirmed" ? "Scheduled visit" : "Preferred schedule"}</dt><dd className="mt-0.5 font-semibold">{scheduleLabel}</dd></div></div>
                <div className="flex gap-3"><MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={18}/><div><dt className="text-admin-text-muted">Location</dt><dd className="mt-0.5 font-semibold">{status.shopName} · {status.branchName}</dd></div></div>
                <div className="flex gap-3"><Scissors aria-hidden="true" className="mt-0.5 shrink-0 text-brand-primary" size={18}/><div><dt className="text-admin-text-muted">{serviceLabel}</dt><dd className="mt-1"><ul id="public-booking-status-services" className="space-y-1 font-semibold">{status.services.map((service, index) => <li key={`${index}-${service}`}>{service}</li>)}</ul></dd></div></div>
              </dl>
              {status.declineReason ? <div id="public-booking-status-response" className="mt-5 rounded-ui-md border border-status-danger/20 bg-status-danger-tint p-4"><p className="text-xs font-semibold uppercase tracking-wide text-status-danger">Business response</p><p className="mt-1 text-sm">{status.declineReason}</p></div> : null}
            </section>

            <section id="public-booking-status-progress" aria-labelledby="public-booking-progress-title">
              <h2 id="public-booking-progress-title" className="font-semibold">Progress</h2>
              <ol className="mt-4">
                <TimelineStep complete={state.stage > 1} current={state.stage === 1} label="Request received" description="Your selected schedule and details were sent securely."/>
                <TimelineStep complete={state.stage > 2 || status.status === "confirmed"} current={state.stage === 2} label="Business confirmation" description={status.status === "declined" ? "The request was reviewed but could not be accepted." : status.status === "confirmed" ? "The business confirmed your appointment." : "Waiting for the business to review your request."}/>
                <TimelineStep complete={state.stage === 3 && status.appointmentStatus === "completed"} current={state.stage === 3 && !state.terminal} label="Appointment" description={status.appointmentStatus === "completed" ? "Your appointment was completed." : ["checked_in", "queued", "in_service"].includes(status.appointmentStatus ?? "") ? "Your visit is in progress." : "This step begins when you arrive for your confirmed visit."}/>
              </ol>
            </section>
          </div>

          <div className="border-t border-admin-border bg-admin-surface-muted px-5 py-4 sm:px-7"><BookingStatusRefresh terminal={state.terminal} checkedAt={status.updatedAt ?? new Date().toISOString()}/></div>
        </Card>

        <aside className="space-y-4">
          <Card elevation="none" className="p-5"><ShieldCheck aria-hidden="true" className="text-brand-primary" size={22}/><h2 className="mt-3 font-semibold">Keep this link private</h2><p className="mt-2 text-sm leading-6 text-admin-text-muted">Anyone with this secure link can see this booking’s progress. Your contact details are not displayed.</p></Card>
          {safeShopSlug ? <Button id="public-booking-status-new-request-button" asChild variant="secondary" className="w-full"><Link href={`/shop/${encodeURIComponent(safeShopSlug)}/book`}>Create another booking</Link></Button> : null}
        </aside>
      </div>
    </div>
  </main>;
}
