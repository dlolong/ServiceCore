"use client";

import { useState } from "react";

import { BusinessTypeSelector } from "@/components/business-type-selector";
import { Input } from "@/components/ui/input";
import { slugifyOrganizationName } from "@/lib/auth/schemas";
import type { PublicProductKey } from "@/modules/platform/product-entry";

export function BusinessIdentityFields({ initialIndustry }: { initialIndustry: PublicProductKey }) {
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <>
      <BusinessTypeSelector idPrefix="negosu-onboarding" initialIndustry={initialIndustry} includeBusinessType />
      <label className="block text-sm font-semibold" htmlFor="negosu-business-name-input">
        Business name
        <Input id="negosu-business-name-input" required maxLength={120} name="businessName" autoComplete="organization" placeholder={initialIndustry === "salon" ? "Glow Beauty Lounge" : "AutoShine Detailing"} className="mt-2" onChange={(event) => {
          if (!slugEdited) setSlug(slugifyOrganizationName(event.target.value));
        }} />
      </label>
      <label className="block text-sm font-semibold" htmlFor="negosu-business-slug-input">
        Business URL
        <div className="mt-2 flex min-w-0 items-center rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-blue-100">
          <span className="shrink-0 pl-3 text-sm text-zinc-600">/shop/</span>
          <input id="negosu-business-slug-input" required minLength={2} maxLength={70} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-2 py-2 text-zinc-950 outline-none" />
        </div>
        <span className="mt-1 block text-xs font-normal text-zinc-600">We automatically add -2, -3, and so on if the URL is already taken.</span>
      </label>
    </>
  );
}
