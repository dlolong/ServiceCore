import Link from "next/link";

import {
  addGalleryImage,
  saveBranchPublic,
  savePublicPage,
  togglePublicService,
} from "@/app/dashboard/settings/public-page/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader, StatusPill } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { publicOpeningDayKeys } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";

const openingDayLabels: Record<(typeof publicOpeningDayKeys)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const [query, { activeMembership }, supabase] = await Promise.all([
    searchParams,
    getDashboardContext(),
    createClient(),
  ]);

  const [{ data: organization, error: organizationError }, { data: branches, error: branchesError }, { data: services, error: servicesError }, { data: gallery, error: galleryError }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("slug,public_page_enabled,public_description,logo_url,cover_url,instagram_url,facebook_page,website")
        .eq("id", activeMembership.organizationId)
        .single(),
      supabase
        .from("branches")
        .select("id,name,public_description,map_url,opening_hours,accepts_public_bookings")
        .in("id", activeMembership.branches.map(branch => branch.id))
        .eq("is_active", true)
        .eq("organization_id", activeMembership.organizationId)
        .order("name"),
      supabase
        .from("services")
        .select("id,name,is_public")
        .eq("organization_id", activeMembership.organizationId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("shop_gallery_images")
        .select("id,url,alt_text")
        .eq("organization_id", activeMembership.organizationId),
    ]);

  if (organizationError || branchesError || servicesError || galleryError || !organization) {
    return <main id="public-page-settings-page" className="mx-auto max-w-6xl">
      <PageHeader id="public-page-settings-header" title="Website and booking" description="Manage your public page and online booking." />
      <Card id="public-page-settings-load-error" className="mt-6 p-6" role="alert">
        <h2 className="font-semibold">Unable to load public page settings</h2>
        <p className="mt-2 text-sm text-admin-text-muted">Please try again before making changes.</p>
        <Link id="public-page-settings-retry" href="/dashboard/settings/public-page" className="mt-4 inline-block font-semibold text-brand-primary-strong">Try again</Link>
      </Card>
    </main>;
  }

  const publicServiceCount = services.filter(service => service.is_public).length;
  const bookingBranchCount = branches.filter(branch => {
    const openingHours = branch.opening_hours && typeof branch.opening_hours === "object"
      ? branch.opening_hours as Record<string, { closed?: boolean; open?: string; close?: string }>
      : {};
    return branch.accepts_public_bookings && Object.values(openingHours).some(day => day.closed !== true && Boolean(day.open && day.close));
  }).length;
  const readyForRequests = organization.public_page_enabled && publicServiceCount > 0 && bookingBranchCount > 0;
  const publicPageAction = organization.public_page_enabled ? <Button id="public-page-view-link" asChild variant="secondary"><Link href={`/shop/${organization.slug}`} target="_blank" rel="noopener noreferrer">View public page ↗</Link></Button> : null;

  return (
    <main id="public-page-settings-page" className="mx-auto max-w-6xl">
      <PageHeader
        id="public-page-settings-header"
        eyebrow="Public storefront"
        title="Website and booking"
        description="Control the services, branches, business details, and images customers can see."
        action={publicPageAction}
      />
      <FormMessage {...query} />
      <Card id="public-page-readiness-card" elevation="none" className="mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-admin-text">Online booking readiness</h2><p id="public-page-setup-help" className="mt-1 text-sm text-admin-text-muted">Complete these essentials, then review incoming requests in <Link href="/dashboard/bookings" className="font-semibold text-brand-primary-strong">Booking Requests</Link>.</p></div><StatusPill active={readyForRequests} activeLabel="Ready for requests" inactiveLabel="Setup needed"/></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ReadinessItem id="public-page-publish-readiness" complete={organization.public_page_enabled} label="Public page" detail={organization.public_page_enabled ? "Published" : "Not published"}/>
          <ReadinessItem id="public-page-services-readiness" complete={publicServiceCount > 0} label={activeMembership.industry === "salon" ? "Treatments" : "Services"} detail={`${publicServiceCount} visible`}/>
          <ReadinessItem id="public-page-branches-readiness" complete={bookingBranchCount > 0} label="Booking locations" detail={`${bookingBranchCount} accepting requests`}/>
        </div>
      </Card>

      <div id="public-page-settings-grid" className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card id="public-page-profile-card" className="p-5">
          <h2 className="font-semibold text-admin-text">{activeMembership.industry === "salon" ? "Salon page" : "Shop page"}</h2>
          <form id="public-page-profile-form" action={savePublicPage} className="mt-4 grid gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-admin-text">
              <input
                id="public-page-enabled-checkbox"
                type="checkbox"
                name="enabled"
                defaultChecked={organization?.public_page_enabled}
              />
              Publish public page
            </label>
            <label className="text-sm font-medium text-admin-text">
              Business description
              <textarea
                id="public-page-description-input"
                name="description"
                defaultValue={organization?.public_description ?? ""}
                className="mt-1.5 min-h-28 w-full rounded-ui-md border border-admin-border bg-white p-3"
              />
            </label>
            <PublicPageField id="public-page-logo-url-input" label="Logo image URL" name="logoUrl" value={organization?.logo_url} />
            <PublicPageField id="public-page-cover-url-input" label="Cover image URL" name="coverUrl" value={organization?.cover_url} />
            <PublicPageField id="public-page-website-input" label="Website URL" name="website" value={organization?.website} />
            <PublicPageField id="public-page-facebook-input" label="Facebook URL" name="facebookPage" value={organization?.facebook_page} />
            <PublicPageField id="public-page-instagram-input" label="Instagram URL" name="instagramUrl" value={organization?.instagram_url} />
            <SubmitButton id="public-page-save-button" pendingText="Saving…">Save public page</SubmitButton>
          </form>
        </Card>

        <Card id="public-services-card" className="p-5">
          <h2 className="font-semibold text-admin-text">Public services</h2>
          <p className="mt-1 text-sm text-admin-text-muted">Only services marked Visible publicly appear in the Request Booking dropdown.</p>
          <div id="public-services-list" className="mt-4 divide-y divide-admin-border">
            {services?.map((service) => (
              <form
                id={`public-service-form-${service.id}`}
                action={togglePublicService}
                className="flex min-h-16 items-center justify-between gap-3 py-3"
                key={service.id}
              >
                <input type="hidden" name="serviceId" value={service.id} />
                <input type="hidden" name="isPublic" value={String(!service.is_public)} />
                <span className="min-w-0 text-sm font-medium text-admin-text">
                  {service.name}
                  <small className="block text-admin-text-muted">{service.is_public ? "Visible publicly" : "Private"}</small>
                </span>
                <SubmitButton id={`public-service-toggle-button-${service.id}`} pendingText="Updating…" variant="secondary">
                  {service.is_public ? "Hide" : "Publish"}
                </SubmitButton>
              </form>
            ))}
            {!services?.length ? <p id="public-services-empty-state" className="py-4 text-sm text-admin-text-muted">No active services are available. Create a service before enabling online booking.</p> : null}
          </div>
        </Card>

        <section id="public-page-locations-section" className="lg:col-span-2" aria-labelledby="public-page-locations-title">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="public-page-locations-title" className="text-lg font-semibold text-admin-text">Booking locations</h2><p className="mt-1 text-sm text-admin-text-muted">Set where customers can request appointments and when each location is open.</p></div><span className="text-sm font-medium text-admin-text-secondary">{bookingBranchCount} of {branches.length} enabled</span></div>
          <div className="mt-3 grid gap-5 xl:grid-cols-2">
            {branches.map((branch) => {
              const hours = branch.opening_hours && typeof branch.opening_hours === "object"
                ? branch.opening_hours as Record<string, { open?: string; close?: string; closed?: boolean }>
                : {};
              return <Card id={`public-branch-card-${branch.id}`} className="p-5" key={branch.id}>
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-admin-text">{branch.name}</h3><StatusPill active={branch.accepts_public_bookings} activeLabel="Accepting requests" inactiveLabel="Requests off"/></div>
                <form id={`public-branch-form-${branch.id}`} action={saveBranchPublic} className="mt-4 grid gap-4">
                  <input type="hidden" name="branchId" value={branch.id}/>
                  <label className="flex min-h-11 items-center gap-2 rounded-ui-md border border-admin-border bg-admin-surface-muted px-3 text-sm font-medium text-admin-text"><input id={`public-branch-bookings-checkbox-${branch.id}`} type="checkbox" name="acceptsBookings" defaultChecked={branch.accepts_public_bookings}/>Accept online requests at this location</label>
                  <label className="text-sm font-medium text-admin-text">Branch description<textarea id={`public-branch-description-input-${branch.id}`} name="description" defaultValue={branch.public_description ?? ""} className="mt-1.5 min-h-20 w-full rounded-ui-md border border-admin-border bg-white p-3"/></label>
                  <PublicPageField id={`public-branch-map-url-input-${branch.id}`} label="Public map URL" name="mapUrl" value={branch.map_url}/>
                  <fieldset id={`public-branch-hours-${branch.id}`} className="rounded-ui-lg border border-admin-border p-3">
                    <legend className="px-1 text-sm font-semibold text-admin-text">Weekly booking hours</legend>
                    <p className="px-1 text-xs text-admin-text-muted">Turn a day off to mark the location closed.</p>
                    <div className="mt-3 divide-y divide-admin-border">{publicOpeningDayKeys.map(day => {
                      const schedule = hours?.[day] ?? { closed: true };
                      const enabled = schedule.closed !== true;
                      return <div id={`public-branch-hours-${day}-${branch.id}`} key={day} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,1fr)_auto_auto] sm:items-end">
                        <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input id={`public-branch-${day}-enabled-${branch.id}`} type="checkbox" name={`hours-${day}-enabled`} defaultChecked={enabled}/>{openingDayLabels[day]}</label>
                        <label className="text-xs font-medium text-admin-text-secondary">Opens<Input id={`public-branch-${day}-open-${branch.id}`} type="time" required name={`hours-${day}-open`} defaultValue={schedule.open ?? "09:00"} className="mt-1 w-full sm:w-28"/></label>
                        <label className="text-xs font-medium text-admin-text-secondary">Closes<Input id={`public-branch-${day}-close-${branch.id}`} type="time" required name={`hours-${day}-close`} defaultValue={schedule.close ?? "17:00"} className="mt-1 w-full sm:w-28"/></label>
                      </div>;
                    })}</div>
                  </fieldset>
                  <SubmitButton id={`public-branch-save-button-${branch.id}`} pendingText="Saving…">Save location</SubmitButton>
                </form>
              </Card>;
            })}
          </div>
        </section>

        <Card id="public-gallery-card" className="p-5 lg:col-span-2">
          <div><h2 className="font-semibold text-admin-text">Gallery</h2><p className="mt-1 text-sm text-admin-text-muted">Add clear, well-lit photos that help customers understand your business.</p></div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <form id="public-gallery-form" action={addGalleryImage} className="grid content-start gap-4 rounded-ui-lg bg-admin-surface-muted p-4">
              <PublicPageField id="public-gallery-url-input" label="Public image URL" name="url" type="url" required />
              <PublicPageField id="public-gallery-alt-input" label="Image description" name="alt" required />
              <SubmitButton id="public-gallery-add-button" pendingText="Adding…">Add image</SubmitButton>
            </form>
            <div id="public-gallery-grid" className="grid grid-cols-2 content-start gap-2 sm:grid-cols-3">
              {gallery.map((image) => (
              // Organization-provided image hosts are intentionally not constrained by Next Image configuration.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                id={`public-gallery-image-${image.id}`}
                className="aspect-square w-full rounded-ui-md object-cover"
                src={image.url}
                alt={image.alt_text}
                width={400}
                height={400}
                key={image.id}
              />
              ))}
              {!gallery.length ? <p id="public-gallery-empty-state" className="col-span-full rounded-ui-lg border border-dashed border-admin-border-strong p-6 text-center text-sm text-admin-text-muted">No gallery images yet.</p> : null}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

function ReadinessItem({ id, complete, label, detail }: { id: string; complete: boolean; label: string; detail: string }) {
  return <div id={id} className="flex items-center justify-between gap-3 rounded-ui-md border border-admin-border bg-admin-surface-muted px-3 py-3"><span><strong className="block text-sm text-admin-text">{label}</strong><small className="text-admin-text-muted">{detail}</small></span><StatusPill active={complete} activeLabel="Ready" inactiveLabel="Needed"/></div>;
}

function PublicPageField({
  id,
  label,
  name,
  value,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  name: string;
  value?: string | null;
  type?: "text" | "url";
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-admin-text" htmlFor={id}>
      {label}
      <Input id={id} required={required} type={type} name={name} defaultValue={value ?? ""} className="mt-1.5" />
    </label>
  );
}
