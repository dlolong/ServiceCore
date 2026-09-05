"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORGANIZATION_COOKIE, requireAuthenticatedUser } from "@/lib/auth/context";
import { createFirstOrganizationWithCompatibility } from "@/lib/auth/organization-onboarding";
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

function organizationCreationErrorMessage(errorCode: string | null) {
  if (errorCode === "P0001") return "This account has already started business setup.";
  if (errorCode === "ONBOARDING_SCHEMA_OUTDATED") return "Salon & Beauty setup is temporarily unavailable while the database is being updated.";
  return "Unable to create the business. Check the details and try again.";
}

export async function createOrganization(formData: FormData) {
  const parsed = businessOnboardingSchema.safeParse({
    industry: value(formData, "industry"),
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
  const result = await createFirstOrganizationWithCompatibility(
    (parameters) => supabase.rpc("create_first_organization", parameters),
    parsed.data,
  );

  if (!result.organizationId) {
    console.error("Organization onboarding failed", { code: result.errorCode });
    const message = organizationCreationErrorMessage(result.errorCode);
    redirect(`/onboarding/business?error=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, result.organizationId, activeOrganizationCookieOptions);
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
    if (error?.code === "P0001") redirect("/onboarding/setup");
    const message = error?.code === "42501" ? "You are not authorized to create this branch." : "Unable to create the branch. Check the details and try again.";
    redirect(`/onboarding/branch?error=${encodeURIComponent(message)}`);
  }

  redirect("/onboarding/setup");
}
