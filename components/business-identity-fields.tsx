"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { businessTypes, slugifyOrganizationName } from "@/lib/auth/schemas";

export function BusinessIdentityFields() {
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <>
      <label className="block text-sm font-semibold">
        Business name
        <Input required maxLength={120} name="businessName" autoComplete="organization" placeholder="AutoShine Detailing" className="mt-2" onChange={(event) => {
          if (!slugEdited) setSlug(slugifyOrganizationName(event.target.value));
        }} />
      </label>
      <label className="block text-sm font-semibold">
        Business type
        <select required name="businessType" defaultValue="" className="mt-2 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-950">
          <option value="" disabled>Select your business type</option>
          {businessTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Shop URL
        <div className="mt-2 flex min-w-0 items-center rounded-xl border border-zinc-300 bg-white focus-within:border-amber-500">
          <span className="shrink-0 pl-3 text-sm text-zinc-600">/shop/</span>
          <input required minLength={2} maxLength={70} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase()); }} className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-2 py-2 text-zinc-950 outline-none" />
        </div>
        <span className="mt-1 block text-xs font-normal text-zinc-600">We automatically add -2, -3, and so on if the URL is already taken.</span>
      </label>
    </>
  );
}
