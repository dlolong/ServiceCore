import { redirect } from "next/navigation";

import { createOrganization } from "@/app/onboarding/actions";
import { BusinessIdentityFields } from "@/components/business-identity-fields";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export default async function BusinessOnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, { supabase, user }] = await Promise.all([searchParams, requireAuthenticatedUser("/onboarding/business")]);
  const destination = await resolveOnboardingDestination(supabase, user.id);
  if (destination.path !== "/onboarding/business") redirect(destination.path);

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-bold text-amber-700">KarKR setup · Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Tell us about your business.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">We’ll create your private organization and assign you as its owner. You can add the first branch next.</p>
        <FormMessage error={error} />
        <form action={createOrganization} className="mt-7 space-y-5">
          <BusinessIdentityFields />
          <label className="block text-sm font-semibold">Registered business name <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={120} autoComplete="organization" name="legalName" className="mt-2" /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Business phone <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={30} autoComplete="tel" name="phone" type="tel" className="mt-2" /></label>
            <label className="block text-sm font-semibold">Business email <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={254} autoComplete="email" name="email" type="email" className="mt-2" /></label>
          </div>
          <label className="block text-sm font-semibold">Website <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={500} name="website" type="url" placeholder="https://example.com" className="mt-2" /></label>
          <label className="block text-sm font-semibold">Facebook page <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={500} name="facebookPage" type="url" placeholder="https://facebook.com/yourshop" className="mt-2" /></label>
          <div className="grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-2"><div><span className="block text-xs text-zinc-600">Currency</span><strong>PHP</strong></div><div><span className="block text-xs text-zinc-600">Timezone</span><strong>Asia/Manila</strong></div></div>
          <SubmitButton className="w-full" pendingText="Creating business…">Continue to branch setup</SubmitButton>
        </form>
      </section>
    </main>
  );
}
