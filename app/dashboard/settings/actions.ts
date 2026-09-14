"use server";

import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/context";
import { firstIssue, profileSchema } from "@/lib/auth/schemas";
import { isDashboardTheme } from "@/modules/platform/dashboard-theme";

function value(formData: FormData, key: string) {
  const submitted = formData.get(key);
  return typeof submitted === "string" ? submitted : "";
}

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({ fullName: value(formData, "fullName"), phone: value(formData, "phone") });
  if (!parsed.success) redirect(`/dashboard/settings?error=${encodeURIComponent(firstIssue(parsed.error))}`);

  const { supabase, user } = await requireAuthenticatedUser("/dashboard/settings");
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null }).eq("id", user.id);
  if (error) redirect("/dashboard/settings?error=Unable+to+update+your+profile.");
  redirect("/dashboard/settings?message=Profile+updated.");
}

export async function updateDashboardTheme(formData: FormData) {
  const theme = value(formData, "dashboardTheme");
  if (!isDashboardTheme(theme)) redirect("/dashboard/settings?error=Select+a+valid+color+theme.");

  const { supabase } = await requireAuthenticatedUser("/dashboard/settings");
  const { error } = await supabase.auth.updateUser({ data: { dashboard_theme: theme } });
  if (error) redirect("/dashboard/settings?error=Unable+to+update+your+color+theme.");
  redirect("/dashboard/settings?message=Color+theme+updated.");
}
