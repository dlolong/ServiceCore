"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORGANIZATION_COOKIE, requireAuthenticatedUser } from "@/lib/auth/context";
import { firstIssue, onboardingSchema } from "@/lib/auth/schemas";

function value(formData: FormData, key: string) {
  const submitted = formData.get(key);
  return typeof submitted === "string" ? submitted : "";
}

export async function createOrganization(formData: FormData) {
  const parsed = onboardingSchema.safeParse({ businessName: value(formData, "businessName"), slug: value(formData, "slug"), phone: value(formData, "phone") });
  if (!parsed.success) redirect(`/onboarding?error=${encodeURIComponent(firstIssue(parsed.error))}`);

  const { supabase } = await requireAuthenticatedUser("/onboarding");
  const { data, error } = await supabase.rpc("create_first_organization", {
    p_name: parsed.data.businessName,
    p_slug: parsed.data.slug,
    p_phone: parsed.data.phone || null,
  });

  if (error || typeof data !== "string") {
    const message = error?.code === "23505" ? "That shop URL is already in use." : "Unable to create the shop. Check the details and try again.";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
