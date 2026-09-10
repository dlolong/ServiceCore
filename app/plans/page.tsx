import type { Metadata } from "next";

import { PublicPlanCatalog } from "@/components/marketing/plan-catalog";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/product-landing";

export const metadata: Metadata = {
  title: { absolute: "Plans and Pricing | NegOSu" },
  description: "Compare NegOSu plans for Automotive and Salon & Beauty businesses.",
  alternates: { canonical: "/plans" },
};

export default function PlansPage() {
  return (
    <main id="negosu-plans-page" className="min-h-screen overflow-x-clip bg-white text-brand-ink">
      <MarketingHeader />
      <header id="negosu-plans-header" className="mx-auto max-w-7xl px-4 pb-3 pt-10 sm:px-6 sm:pt-14">
        <p className="text-sm font-semibold text-brand-primary-strong">NegOSu pricing</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">A practical plan for every stage of your service business.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">Use the same secure operating platform with workflows tailored to Automotive or Salon &amp; Beauty.</p>
      </header>
      <PublicPlanCatalog />
      <MarketingCta title="Ready to set up your business?" description="Create your free account, choose your industry, and start with the essentials. You can change plans later." />
      <MarketingFooter />
    </main>
  );
}
