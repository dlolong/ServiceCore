import Link from "next/link";

import { reviewBooking } from "@/app/dashboard/bookings/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

type BookingRequest = {
  id: string;
  customer_name: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  phone: string;
  email: string | null;
  public_reference: string;
  status: string;
  preferred_at: string;
  customer_note: string | null;
  public_booking_services: Array<{ service_name_snapshot: string; price_centavos: number }>;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ message?: string; error?: string }> }) {
  const [params, { activeMembership }, supabase] = await Promise.all([
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);
  const { data: requests, error } = await supabase
    .from("public_booking_requests")
    .select("*,public_booking_services(service_name_snapshot,price_centavos)")
    .eq("organization_id", activeMembership.organizationId)
    .eq("branch_id", activeMembership.branchId)
    .order("created_at", { ascending: false });
  const bookingRequests = (requests ?? []) as BookingRequest[];

  return (
    <main id="booking-requests-page" className="mx-auto w-full max-w-5xl">
      <header id="booking-requests-page-header">
        <p className="text-sm font-medium text-brand-primary">{activeMembership.branchName}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Online booking requests</h1>
        <p className="mt-2 text-sm text-zinc-600 sm:text-base">Review public requests without exposing the private schedule.</p>
      </header>

      <FormMessage {...params} />

      {error ? (
        <Card id="booking-requests-error" className="mt-5 p-6 text-center" role="alert">
          <h2 className="font-semibold">Could not load booking requests</h2>
          <p className="mt-2 text-sm text-zinc-600">Try loading this page again. No booking request was changed.</p>
          <Button id="booking-requests-retry-button" asChild className="mt-4" variant="secondary">
            <Link href="/dashboard/bookings">Try again</Link>
          </Button>
        </Card>
      ) : bookingRequests.length ? (
        <section id="booking-requests-list" aria-label="Online booking requests" className="mt-5 space-y-3">
          {bookingRequests.map((request) => (
            <Card id={`booking-request-card-${request.id}`} className="p-4 sm:p-5" key={request.id}>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block break-words font-medium">{request.customer_name}{activeMembership.industry === "automotive" ? ` · ${request.vehicle_make ?? ""} ${request.vehicle_model ?? ""}` : ""}</strong>
                  <small className="mt-1 block break-words text-zinc-500">
                    {request.phone}{request.email ? ` · ${request.email}` : ""} · {request.public_reference}
                  </small>
                </div>
                <span id={`booking-request-status-${request.id}`} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-700">
                  {request.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6">
                {request.public_booking_services.map((service) => service.service_name_snapshot).join(", ")} ·{" "}
                {new Intl.DateTimeFormat("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: activeMembership.timezone,
                }).format(new Date(request.preferred_at))}
              </p>
              {request.customer_note ? <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm">{request.customer_note}</p> : null}
              {request.status === "requested" && roleHasPermission(activeMembership.role, "appointments.manage") ? (
                <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:flex sm:flex-wrap sm:items-end">
                  <form id={`booking-request-confirm-form-${request.id}`} action={reviewBooking}>
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="action" value="confirm" />
                    <SubmitButton id={`booking-request-confirm-button-${request.id}`} className="w-full sm:w-auto" pendingText="Confirming…">
                      Confirm and create appointment
                    </SubmitButton>
                  </form>
                  <form id={`booking-request-decline-form-${request.id}`} action={reviewBooking} className="grid min-w-0 gap-2 sm:flex sm:flex-1 sm:items-end">
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="action" value="decline" />
                    <label className="min-w-0 flex-1 text-xs font-medium text-zinc-600" htmlFor={`booking-request-decline-reason-${request.id}`}>
                      Decline reason <span className="font-normal">(optional)</span>
                      <input
                        id={`booking-request-decline-reason-${request.id}`}
                        className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm text-zinc-950"
                        name="reason"
                      />
                    </label>
                    <SubmitButton id={`booking-request-decline-button-${request.id}`} className="w-full sm:w-auto" pendingText="Declining…" variant="destructive">
                      Decline
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
            </Card>
          ))}
        </section>
      ) : (
        <Card id="booking-requests-empty-state" className="mt-5 p-7 text-center sm:p-10">
          <h2 className="font-semibold">No booking requests yet</h2>
          <p className="mt-2 text-sm text-zinc-600">New public requests for this branch will appear here.</p>
        </Card>
      )}
    </main>
  );
}
