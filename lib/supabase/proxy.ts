import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseBrowserConfig } from "@/lib/env/client";
import { privateEstimateResponseHeaders } from "@/lib/private-route-security";

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseBrowserConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedRoute = ["/dashboard", "/onboarding", "/customers", "/vehicles", "/appointments", "/jobs", "/services", "/inventory", "/reports", "/settings"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!user && protectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const privateHeaders=privateEstimateResponseHeaders(pathname);
  if (privateHeaders) {
    for(const [name,value] of Object.entries(privateHeaders))response.headers.set(name,value);
  }

  return response;
}
