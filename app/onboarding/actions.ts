"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORGANIZATION_COOKIE, requireAuthenticatedUser } from "@/lib/auth/context";
import { branchOnboardingSchema, businessOnboardingSchema, firstIssue } from "@/lib/auth/schemas";

function value(formData: FormData, key: string) {
  const submitted = formData.get(key);
  return typeof submitted === "string" ? submitted : "";
}

const activeOrganizationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function createOrganization(formData: FormData) {
  const parsed = businessOnboardingSchema.safeParse({
    businessName: value(formData, "businessName"),
    businessType: value(formData, "businessType"),
    slug: value(formData, "slug"),
    legalName: value(formData, "legalName"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    website: value(formData, "website"),
    facebookPage: value(formData, "facebookPage"),
  });
  if (!parsed.success) redirect(`/onboarding/business?error=${encodeURIComponent(firstIssue(parsed.error))}`);

  const { supabase } = await requireAuthenticatedUser("/onboarding/business");
  const { data, error } = await supabase.rpc("create_first_organization", {
    p_name: parsed.data.businessName,
    p_business_type: parsed.data.businessType,
    p_slug_base: parsed.data.slug,
    p_legal_name: parsed.data.legalName || null,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_website: parsed.data.website || null,
    p_facebook_page: parsed.data.facebookPage || null,
  });

  if (error || typeof data !== "string") {
    console.error("Organization onboarding failed", { code: error?.code });
    const message = error?.code === "P0001" ? "This account has already started shop setup." : "Unable to create the business. Check the details and try again.";
    redirect(`/onboarding/business?error=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, data, activeOrganizationCookieOptions);
  redirect("/onboarding/branch");
}

export async function createInitialBranch(formData: FormData) {
  const parsed = branchOnboardingSchema.safeParse({
    organizationId: value(formData, "organizationId"),
    branchName: value(formData, "branchName"),
    addressLine: value(formData, "addressLine"),
    barangay: value(formData, "barangay"),
    city: value(formData, "city"),
    province: value(formData, "province"),
    postalCode: value(formData, "postalCode"),
    country: value(formData, "country"),
    phone: value(formData, "phone"),
    email: value(formData, "email"),
    openingNotes: value(formData, "openingNotes"),
  });
  if (!parsed.success) redirect(`/onboarding/branch?error=${encodeURIComponent(firstIssue(parsed.error))}`);

  const { supabase } = await requireAuthenticatedUser("/onboarding/branch");
  const { data, error } = await supabase.rpc("create_initial_branch", {
    p_organization_id: parsed.data.organizationId,
    p_name: parsed.data.branchName,
    p_address_line: parsed.data.addressLine,
    p_barangay: parsed.data.barangay || null,
    p_city: parsed.data.city,
    p_province: parsed.data.province,
    p_postal_code: parsed.data.postalCode || null,
    p_country: parsed.data.country,
    p_phone: parsed.data.phone || null,
    p_email: parsed.data.email || null,
    p_opening_notes: parsed.data.openingNotes || null,
  });

  if (error || typeof data !== "string") {
    console.error("Initial branch onboarding failed", { code: error?.code });
    const message = error?.code === "42501" ? "You are not authorized to create this branch." : "Unable to create the branch. Check the details and try again.";
    redirect(`/onboarding/branch?error=${encodeURIComponent(message)}`);
  }

  redirect("/dashboard");
}
