import { redirect } from "next/navigation";

import { createOrganization } from "@/app/onboarding/actions";
import { BusinessIdentityFields } from "@/components/business-identity-fields";
import { BrandWordmark } from "@/components/brand-wordmark";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { resolveProductEntry } from "@/modules/platform/product-entry";

export default async function BusinessOnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, { supabase, user }] = await Promise.all([searchParams, requireAuthenticatedUser("/onboarding/business")]);
  const destination = await resolveOnboardingDestination(supabase, user.id);
  if (destination.path !== "/onboarding/business") redirect(destination.path);
  const entry = resolveProductEntry(user.user_metadata.signup_industry);

  return (
    <main id="negosu-onboarding-business-page" className="min-h-dvh bg-slate-50 px-4 py-8 sm:px-5 sm:py-12">
      <section id="negosu-onboarding-business-card" className="mx-auto w-full max-w-2xl rounded-ui-lg border border-brand-border bg-white p-5 shadow-ui-md sm:p-9">
        <div className="flex flex-col items-start gap-1"><BrandWordmark className="w-32" /><span className="text-xs font-bold tracking-wide text-zinc-500">{entry.productName}</span></div>
        <p className="mt-5 text-sm font-bold text-brand-primary-strong">Setup · Step 1 of 2</p>
        <h1 id="negosu-onboarding-business-title" className="mt-2 text-3xl font-black tracking-tight">Tell us about your business.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">We’ll create your private organization and assign you as its owner. You can add the first branch next.</p>
        <FormMessage error={error} />
        <form id="negosu-onboarding-business-form" action={createOrganization} className="mt-7 space-y-5">
          <BusinessIdentityFields initialIndustry={entry.industry} />
          <label className="block text-sm font-semibold" htmlFor="negosu-business-legal-name-input">Registered business name <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-business-legal-name-input" maxLength={120} autoComplete="organization" name="legalName" className="mt-2" /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold" htmlFor="negosu-business-phone-input">Business phone <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-business-phone-input" maxLength={30} autoComplete="tel" name="phone" type="tel" className="mt-2" /></label>
            <label className="block text-sm font-semibold" htmlFor="negosu-business-email-input">Business email <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-business-email-input" maxLength={254} autoComplete="email" name="email" type="email" className="mt-2" /></label>
          </div>
          <label className="block text-sm font-semibold" htmlFor="negosu-business-website-input">Website <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-business-website-input" maxLength={500} name="website" type="url" placeholder="https://example.com" className="mt-2" /></label>
          <label className="block text-sm font-semibold" htmlFor="negosu-business-facebook-input">Facebook page <span className="font-normal text-zinc-600">(optional)</span><Input id="negosu-business-facebook-input" maxLength={500} name="facebookPage" type="url" placeholder="https://facebook.com/yourbusiness" className="mt-2" /></label>
          <div id="negosu-business-defaults" className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><span className="block text-xs text-zinc-600">Currency</span><strong>PHP</strong></div><div><span className="block text-xs text-zinc-600">Timezone</span><strong>Asia/Manila</strong></div></div>
          <SubmitButton id="negosu-business-submit-button" className="w-full" pendingText="Creating business…">Continue to branch setup</SubmitButton>
        </form>
      </section>
    </main>
  );
}
