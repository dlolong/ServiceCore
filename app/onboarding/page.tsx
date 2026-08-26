import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export default async function OnboardingPage() {
  const { supabase, user } = await requireAuthenticatedUser("/onboarding");
  redirect((await resolveOnboardingDestination(supabase, user.id)).path);
}
