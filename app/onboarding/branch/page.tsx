import { redirect } from "next/navigation";

import { createInitialBranch } from "@/app/onboarding/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export default async function BranchOnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, { supabase, user }] = await Promise.all([searchParams, requireAuthenticatedUser("/onboarding/branch")]);
  const destination = await resolveOnboardingDestination(supabase, user.id);
  if (destination.path !== "/onboarding/branch" || !destination.organizationId) redirect(destination.path);
  const { data: organization } = await supabase.from("organizations").select("name").eq("id", destination.organizationId).single();

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-8 sm:py-12">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-bold text-amber-700">KarKR setup · Step 2 of 2</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Set up your main branch.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Add the first operating location for {organization?.name ?? "your business"}. It becomes the default branch.</p>
        <FormMessage error={error} />
        <form action={createInitialBranch} className="mt-7 space-y-5">
          <input type="hidden" name="organizationId" value={destination.organizationId} />
          <label className="block text-sm font-semibold">Branch name<Input required maxLength={120} name="branchName" defaultValue="Main Branch" autoComplete="organization" className="mt-2" /></label>
          <label className="block text-sm font-semibold">Address line<Input required maxLength={200} name="addressLine" autoComplete="street-address" placeholder="Building, street, subdivision" className="mt-2" /></label>
          <label className="block text-sm font-semibold">Barangay <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={120} name="barangay" className="mt-2" /></label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">City / municipality<Input required maxLength={120} name="city" autoComplete="address-level2" className="mt-2" /></label>
            <label className="block text-sm font-semibold">Province<Input required maxLength={120} name="province" autoComplete="address-level1" className="mt-2" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Postal code <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={20} name="postalCode" autoComplete="postal-code" inputMode="numeric" className="mt-2" /></label>
            <label className="block text-sm font-semibold">Country<Input required maxLength={120} name="country" autoComplete="country-name" defaultValue="Philippines" className="mt-2" /></label>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Branch phone <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={30} name="phone" type="tel" autoComplete="tel" className="mt-2" /></label>
            <label className="block text-sm font-semibold">Branch email <span className="font-normal text-zinc-600">(optional)</span><Input maxLength={254} name="email" type="email" autoComplete="email" className="mt-2" /></label>
          </div>
          <label className="block text-sm font-semibold">Opening notes <span className="font-normal text-zinc-600">(optional)</span><textarea maxLength={500} name="openingNotes" rows={3} className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-950 placeholder:text-zinc-400" placeholder="Landmark or operating note" /></label>
          <SubmitButton className="w-full" pendingText="Creating branch…">Finish setup</SubmitButton>
        </form>
      </section>
    </main>
  );
}
