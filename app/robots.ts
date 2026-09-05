import type { MetadataRoute } from "next";

import { clientEnv } from "@/lib/env/client";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/automotive", "/salon", "/shop/"],
      disallow: ["/dashboard/", "/onboarding/", "/organizations", "/booking/", "/appointment/", "/estimate/", "/accept-invite"],
    },
    sitemap: `${clientEnv.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
