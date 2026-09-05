import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env/client";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), "/dashboard");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (next.startsWith("/reset-password")) return NextResponse.redirect(new URL(next, clientEnv.NEXT_PUBLIC_APP_URL));
      const destination = await resolveOnboardingDestination(supabase, data.user.id);
      return NextResponse.redirect(new URL(destination.path === "/dashboard" ? next : destination.path, clientEnv.NEXT_PUBLIC_APP_URL));
    }
  }

  const errorUrl = new URL("/login", clientEnv.NEXT_PUBLIC_APP_URL);
  errorUrl.searchParams.set("error", "The authentication link is invalid or expired.");
  return NextResponse.redirect(errorUrl);
}
