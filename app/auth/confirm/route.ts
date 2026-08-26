import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { clientEnv } from "@/lib/env/client";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), rawType === "recovery" ? "/update-password" : "/dashboard");

  if (tokenHash && rawType && allowedTypes.has(rawType as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType as EmailOtpType });
    if (!error) return NextResponse.redirect(new URL(next, clientEnv.NEXT_PUBLIC_APP_URL));
  }

  const errorUrl = new URL("/sign-in", clientEnv.NEXT_PUBLIC_APP_URL);
  errorUrl.searchParams.set("error", "The verification link is invalid or expired.");
  return NextResponse.redirect(errorUrl);
}
