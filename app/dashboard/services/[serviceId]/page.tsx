import Link from "next/link";
import { notFound } from "next/navigation";

import { toggleService } from "@/app/dashboard/operations-actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { formatDuration, formatMoney } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{
    message?: string;
    error?: string;
  }>;
}) {
  const [
    { serviceId },
    messageParams,
    { activeMembership },
    supabase,
  ] = await Promise.all([
    params,
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);

  const isSalon = activeMembership.industry === "salon";
  const canManage = ["owner", "manager"].includes(activeMembership.role);

  const [
    { data: service },
    priceResult,
    { data: availability },
  ] = await Promise.all([
    supabase
      .from("services")
      .select(
        `
          id,
          name,
          description,
          duration_minutes,
          base_price_centavos,
          is_active,
          is_add_on,
          code,
          service_categories(name)
        `,
      )
      .eq("id", serviceId)
      .eq("organization_id", activeMembership.organizationId)
      .maybeSingle(),

    isSalon
      ? Promise.resolve({ data: [] })
      : supabase
          .from("service_prices")
          .select("vehicle_class, price_centavos, branches(name)")
          .eq("service_id", serviceId),

    supabase
      .from("service_branch_availability")
      .select("branches(name)")
      .eq("service_id", serviceId)
      .eq("is_available", true),
  ]);

  if (!service) {
    notFound();
  }

  const category = Array.isArray(service.service_categories)
    ? service.service_categories[0]
    : service.service_categories;

  const prices = priceResult.data;
  const serviceLabel = isSalon ? "treatment" : "service";

  const availableBranches =
    availability
      ?.map((item) => {
        const branch = Array.isArray(item.branches)
          ? item.branches[0]
          : item.branches;

        return branch?.name;
      })
      .filter(Boolean)
      .join(", ") || "All active branches";

  return (
    <div
      id={isSalon ? "salon-treatment-detail-page" : undefined}
      className="mx-auto max-w-4xl"
    >
      {/* Header */}
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-brand-primary">
            {category?.name ?? (isSalon ? "Treatment" : "Service")}
          </p>

          <h1 className="mt-1 text-3xl font-semibold">
            {service.name}
          </h1>

          <p className="mt-2 text-zinc-600">
            {service.description || "No description"}
          </p>
        </div>

        {canManage && (
          <Button
            id={isSalon ? "salon-treatment-edit-button" : undefined}
            asChild
          >
            <Link href={`/dashboard/services/${service.id}/edit`}>
              Edit {serviceLabel}
            </Link>
          </Button>
        )}
      </div>

      <FormMessage {...messageParams} />

      {/* Service information */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {/* Base price */}
        <Card className="p-5">
          <h2 className="font-semibold">Base price</h2>

          <p className="mt-3 text-3xl font-semibold">
            {formatMoney(service.base_price_centavos)}
          </p>

          <p className="mt-1 text-zinc-600">
            {formatDuration(service.duration_minutes)}
            {" · "}
            {service.is_add_on
              ? "Add-on"
              : isSalon
                ? "Treatment"
                : "Service"}
          </p>

          {service.code && (
            <p className="mt-3 text-sm text-zinc-500">
              Code: {service.code}
            </p>
          )}
        </Card>

        {/* Vehicle pricing — automotive only */}
        {!isSalon && (
          <Card className="p-5">
            <h2 className="font-semibold">Vehicle pricing</h2>

            <dl className="mt-3 space-y-2 text-sm">
              {prices?.map((price, index) => {
                const branch = Array.isArray(price.branches)
                  ? price.branches[0]
                  : price.branches;

                return (
                  <div
                    key={index}
                    className="flex justify-between gap-3"
                  >
                    <dt>
                      {price.vehicle_class?.replaceAll("_", " ") ||
                        "Branch base"}

                      {branch ? ` · ${branch.name}` : ""}
                    </dt>

                    <dd className="font-bold">
                      {formatMoney(price.price_centavos)}
                    </dd>
                  </div>
                );
              })}

              {!prices?.length && (
                <p className="text-zinc-600">
                  Uses the base price for every vehicle.
                </p>
              )}
            </dl>
          </Card>
        )}

        {/* Availability */}
        <Card
          className={`p-5 ${
            isSalon ? "sm:col-span-1" : "sm:col-span-2"
          }`}
        >
          <h2 className="font-semibold">Availability</h2>

          <p className="mt-2 text-sm text-zinc-600">
            {availableBranches}
          </p>

          {canManage && (
            <form action={toggleService} className="mt-5">
              <input
                type="hidden"
                name="id"
                value={service.id}
              />

              <input
                type="hidden"
                name="active"
                value={String(!service.is_active)}
              />

              <SubmitButton
                variant={
                  service.is_active ? "destructive" : "secondary"
                }
                pendingText="Updating…"
              >
                {service.is_active
                  ? `Deactivate ${serviceLabel}`
                  : `Activate ${serviceLabel}`}
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}