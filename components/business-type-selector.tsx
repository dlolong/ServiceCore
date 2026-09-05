"use client";

import { BriefcaseBusiness, Scissors } from "lucide-react";
import { useState } from "react";

import { productEntryConfigs, type PublicProductKey } from "@/modules/platform/product-entry";

const choices = [
  {
    industry: "automotive" as const,
    title: "Automotive",
    description: "Car wash, detailing, repair, maintenance, and auto-care services.",
    Icon: BriefcaseBusiness,
  },
  {
    industry: "salon" as const,
    title: "Salon & Beauty",
    description: "Salon, spa, facial, nail, barber, and beauty services.",
    Icon: Scissors,
  },
];

export function BusinessTypeSelector({
  initialIndustry,
  includeBusinessType = false,
  idPrefix,
}: {
  initialIndustry?: PublicProductKey;
  includeBusinessType?: boolean;
  idPrefix: string;
}) {
  const [industry, setIndustry] = useState<PublicProductKey | null>(initialIndustry ?? null);
  const entry = industry ? productEntryConfigs[industry] : null;

  return (
    <fieldset id={`${idPrefix}-business-type-selector`} className="space-y-3">
      <legend className="text-sm font-semibold">What type of business do you operate?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map(({ industry: value, title, description, Icon }) => (
          <label
            id={`${idPrefix}-business-type-${value}-option`}
            key={value}
            className={`cursor-pointer rounded-xl border p-4 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-primary/25 ${industry === value ? "border-brand-primary bg-brand-tint" : "border-zinc-200 bg-white hover:border-brand-border hover:bg-slate-50"}`}
          >
            <input
              id={`${idPrefix}-business-type-${value}`}
              required
              className="sr-only"
              type="radio"
              name="industry"
              value={value}
              checked={industry === value}
              onChange={() => setIndustry(value)}
            />
            <Icon aria-hidden="true" className={`mb-3 ${industry === value ? "text-brand-primary-strong" : "text-slate-600"}`} size={22} />
            <span className="block text-sm font-black">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-zinc-600">{description}</span>
          </label>
        ))}
      </div>
      {includeBusinessType && entry ? (
        <label className="block text-sm font-semibold" htmlFor={`${idPrefix}-business-subtype`}>
          Business type
          <select
            id={`${idPrefix}-business-subtype`}
            required
            name="businessType"
            defaultValue=""
            key={industry ?? "unselected"}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-admin-text focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20"
          >
            <option value="" disabled>Select your {entry.businessTypeLabel.toLowerCase()} business</option>
            {entry.businessTypes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}
