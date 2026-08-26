"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORGANIZATION_COOKIE, requireAuthenticatedUser } from "@/lib/auth/context";
import { organizationIdSchema } from "@/lib/auth/schemas";

export async function switchOrganization(formData: FormData) {
  const parsed = organizationIdSchema.safeParse(formData.get("organizationId"));
  if (!parsed.success) redirect("/dashboard?error=Invalid+organization+selection.");

  const { supabase, user } = await requireAuthenticatedUser();
  const { data } = await supabase.from("organization_memberships").select("organization_id").eq("organization_id", parsed.data).eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (!data) redirect("/dashboard?error=You+do+not+have+access+to+that+organization.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, data.organization_id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
