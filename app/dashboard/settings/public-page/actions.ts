"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireIndustryFeature } from "@/lib/auth/industry-access";
import { firstError, formValue } from "@/lib/crm";
import { branchPublicSchema, publicGallerySchema, publicOpeningHoursFromFormData, publicPageSchema, publicServiceSchema } from "@/lib/public-booking";
import { roleHasPermission } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

const path = "/dashboard/settings/public-page";
function go(kind: "message" | "error", message: string): never { redirect(`${path}?${kind}=${encodeURIComponent(message)}`); }
async function settingsContext() {
  const { activeMembership } = await requireIndustryFeature("booking_requests");
  if (!roleHasPermission(activeMembership.role, "settings.manage")) go("error", "Settings access required.");
  return activeMembership;
}
function saved(slug: string, message: string): never {
  revalidatePath(path); revalidatePath(`/shop/${slug}`); revalidatePath(`/shop/${slug}/book`);
  go("message", message);
}
export async function savePublicPage(data: FormData) {
  const membership = await settingsContext();
  const parsed = publicPageSchema.safeParse({ description: formValue(data, "description"), logoUrl: formValue(data, "logoUrl"), coverUrl: formValue(data, "coverUrl"), instagramUrl: formValue(data, "instagramUrl"), facebookPage: formValue(data, "facebookPage"), website: formValue(data, "website"), enabled: data.get("enabled") === "on" });
  if (!parsed.success) go("error", firstError(parsed.error));
  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("organizations").update({ public_page_enabled: parsed.data.enabled, public_description: parsed.data.description || null, logo_url: parsed.data.logoUrl || null, cover_url: parsed.data.coverUrl || null, instagram_url: parsed.data.instagramUrl || null, facebook_page: parsed.data.facebookPage || null, website: parsed.data.website || null }).eq("id", membership.organizationId).select("id").maybeSingle();
  if (error || !updated) go("error", "Unable to update public page.");
  saved(membership.organizationSlug, "Public page settings saved.");
}
export async function saveBranchPublic(data: FormData) {
  const membership = await settingsContext();
  const parsed = branchPublicSchema.safeParse({ branchId: formValue(data, "branchId"), description: formValue(data, "description"), mapUrl: formValue(data, "mapUrl"), acceptsBookings: data.get("acceptsBookings") === "on", openingHours: JSON.stringify(publicOpeningHoursFromFormData(data)) });
  if (!parsed.success) go("error", firstError(parsed.error));
  const supabase = await createClient();
  const { data: allowed, error: accessError } = await supabase.rpc("can_access_branch", { p_organization_id: membership.organizationId, p_branch_id: parsed.data.branchId });
  if (accessError || allowed !== true) go("error", "Branch access required.");
  const { data: updated, error } = await supabase.from("branches").update({ public_description: parsed.data.description || null, map_url: parsed.data.mapUrl || null, accepts_public_bookings: parsed.data.acceptsBookings, opening_hours: parsed.data.openingHours }).eq("id", parsed.data.branchId).eq("organization_id", membership.organizationId).select("id").maybeSingle();
  if (error || !updated) go("error", "Unable to save branch public settings.");
  saved(membership.organizationSlug, "Branch public settings saved.");
}
export async function togglePublicService(data: FormData) {
  const membership = await settingsContext();
  const parsed = publicServiceSchema.safeParse({ serviceId: formValue(data, "serviceId"), isPublic: formValue(data, "isPublic") });
  if (!parsed.success) go("error", "Select a valid service and visibility.");
  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("services").update({ is_public: parsed.data.isPublic }).eq("id", parsed.data.serviceId).eq("organization_id", membership.organizationId).eq("is_active", true).select("id").maybeSingle();
  if (error || !updated) go("error", "Unable to update public service.");
  saved(membership.organizationSlug, "Public services updated.");
}
export async function addGalleryImage(data: FormData) {
  const membership = await settingsContext();
  const parsed = publicGallerySchema.safeParse({ url: formValue(data, "url"), alt: formValue(data, "alt") });
  if (!parsed.success) go("error", "Enter an HTTP or HTTPS image URL and description.");
  const supabase = await createClient();
  const { error } = await supabase.from("shop_gallery_images").insert({ organization_id: membership.organizationId, url: parsed.data.url, alt_text: parsed.data.alt });
  if (error) go("error", "Unable to add gallery image.");
  saved(membership.organizationSlug, "Gallery image added.");
}
