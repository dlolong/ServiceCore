"use server";

import { redirect } from "next/navigation";

import { activateOrganizationForUser } from "@/lib/auth/active-organization";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { organizationIdSchema } from "@/lib/auth/schemas";

export async function chooseOrganization(formData: FormData) {
  const parsed = organizationIdSchema.safeParse(formData.get("organizationId"));
  if (!parsed.success) redirect("/organizations?error=Invalid+business+selection.");

  const { supabase, user } = await requireAuthenticatedUser("/organizations");
  const destination = await activateOrganizationForUser(supabase, user.id, parsed.data);
  if (!destination) redirect("/organizations?error=You+do+not+have+access+to+that+business.");
  redirect(destination.path);
}
