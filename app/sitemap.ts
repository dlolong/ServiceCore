import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

import { clientEnv, getSupabaseBrowserConfig } from "@/lib/env/client";
import { verticalBrands } from "@/modules/platform/brand";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { url, key } = getSupabaseBrowserConfig();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase.rpc("list_public_shops");
  const lastModified = new Date();

  return [
    { url: clientEnv.NEXT_PUBLIC_APP_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${clientEnv.NEXT_PUBLIC_APP_URL}/plans`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    ...Object.values(verticalBrands).map(({ path }) => ({
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...(data ?? []).map((shop: { slug: string; updated_at: string }) => ({
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/shop/${shop.slug}`,
      lastModified: new Date(shop.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
