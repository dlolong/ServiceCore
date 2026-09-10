import type { MetadataRoute } from "next";

import { clientEnv } from "@/lib/env/client";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/automotive", "/salon", "/plans", "/shop/"],
      disallow: ["/dashboard/", "/onboarding/", "/organizations", "/booking/", "/appointment/", "/estimate/", "/accept-invite", "/display/", "/api/queue-display/"],
    },
    sitemap: `${clientEnv.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
