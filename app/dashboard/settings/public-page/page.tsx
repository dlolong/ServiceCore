import Link from "next/link";

import {
  addGalleryImage,
  saveBranchPublic,
  savePublicPage,
  togglePublicService,
} from "@/app/dashboard/settings/public-page/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: organization }, { data: branches }, { data: services }, { data: gallery }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("slug,public_page_enabled,public_description,logo_url,cover_url,instagram_url,facebook_page,website")
        .eq("id", activeMembership.organizationId)
        .single(),
      supabase
        .from("branches")
        .select("id,name,public_description,map_url,opening_hours,accepts_public_bookings")
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

  const publicPageAction = organization?.public_page_enabled ? (
    <Link
      id="public-page-view-link"
      className="font-semibold text-brand-primary-strong hover:underline"
      href={`/shop/${organization.slug}`}
      target="_blank"
    >
      View public page ↗
    </Link>
  ) : null;

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

      <div id="public-page-settings-grid" className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card id="public-page-profile-card" className="p-5">
          <h2 className="font-semibold text-admin-text">Shop page</h2>
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

        {branches?.map((branch) => (
          <Card id={`public-branch-card-${branch.id}`} className="p-5" key={branch.id}>
            <h2 className="font-semibold text-admin-text">{branch.name}</h2>
            <form id={`public-branch-form-${branch.id}`} action={saveBranchPublic} className="mt-4 grid gap-4">
              <input type="hidden" name="branchId" value={branch.id} />
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-admin-text">
                <input
                  id={`public-branch-bookings-checkbox-${branch.id}`}
                  type="checkbox"
                  name="acceptsBookings"
                  defaultChecked={branch.accepts_public_bookings}
                />
                Accept online requests
              </label>
              <label className="text-sm font-medium text-admin-text">
                Branch description
                <textarea
                  id={`public-branch-description-input-${branch.id}`}
                  name="description"
                  defaultValue={branch.public_description ?? ""}
                  className="mt-1.5 min-h-20 w-full rounded-ui-md border border-admin-border bg-white p-3"
                />
              </label>
              <PublicPageField
                id={`public-branch-map-url-input-${branch.id}`}
                label="Public map URL"
                name="mapUrl"
                value={branch.map_url}
              />
              <label className="text-sm font-medium text-admin-text">
                Opening-hours JSON
                <textarea
                  id={`public-branch-opening-hours-input-${branch.id}`}
                  name="openingHours"
                  defaultValue={JSON.stringify(branch.opening_hours, null, 2)}
                  className="mt-1.5 min-h-64 w-full rounded-ui-md border border-admin-border bg-white p-3 font-mono text-xs"
                />
              </label>
              <SubmitButton id={`public-branch-save-button-${branch.id}`} pendingText="Saving…">Save branch</SubmitButton>
            </form>
          </Card>
        ))}

        <Card id="public-gallery-card" className="p-5">
          <h2 className="font-semibold text-admin-text">Gallery</h2>
          <form id="public-gallery-form" action={addGalleryImage} className="mt-4 grid gap-4">
            <PublicPageField id="public-gallery-url-input" label="Public image URL" name="url" type="url" required />
            <PublicPageField id="public-gallery-alt-input" label="Image description" name="alt" required />
            <SubmitButton id="public-gallery-add-button" pendingText="Adding…">Add image</SubmitButton>
          </form>
          <div id="public-gallery-grid" className="mt-4 grid grid-cols-2 gap-2">
            {gallery?.map((image) => (
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
          </div>
        </Card>
      </div>
    </main>
  );
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
