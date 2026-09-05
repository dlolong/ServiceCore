"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { activateOrganizationForUser } from "@/lib/auth/active-organization";
import { ACTIVE_BRANCH_COOKIE, getDashboardContext, requireAuthenticatedUser } from "@/lib/auth/context";
import { organizationIdSchema } from "@/lib/auth/schemas";

export async function switchOrganization(formData: FormData) {
  const parsed = organizationIdSchema.safeParse(formData.get("organizationId"));
  if (!parsed.success) redirect("/dashboard?error=Invalid+organization+selection.");

  const { supabase, user } = await requireAuthenticatedUser();
  const destination = await activateOrganizationForUser(supabase, user.id, parsed.data);
  if (!destination) redirect("/dashboard?error=You+do+not+have+access+to+that+organization.");
  redirect(destination.path);
}

export async function switchBranch(formData: FormData) {
  const branchId = formData.get("branchId");
  if (typeof branchId !== "string") redirect("/dashboard?error=Invalid+branch+selection.");
  const { activeMembership } = await getDashboardContext();
  const selected = activeMembership.branches.find(({ id }) => id === branchId);
  if (!selected) redirect("/dashboard?error=You+do+not+have+access+to+that+branch.");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, selected.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}
