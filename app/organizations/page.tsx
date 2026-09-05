import { Building2, Check, Scissors, Wrench } from "lucide-react";
import { redirect } from "next/navigation";

import { chooseOrganization } from "@/app/organizations/actions";
import { BrandWordmark } from "@/components/brand-wordmark";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { loadActiveOrganizationMembershipRows, requireAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { resolveProductEntry } from "@/modules/platform/product-entry";

type OrganizationChoiceRow = {
  organization_id: string;
  role: string;
  organizations: { name: string; industry?: string; branches: Array<{ id: string; is_active: boolean }> } | null;
};

export default async function OrganizationSelectorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [params, { supabase, user }] = await Promise.all([searchParams, requireAuthenticatedUser("/organizations")]);
  const { data, error } = await loadActiveOrganizationMembershipRows(supabase, user.id);

  if (error) throw new Error("Unable to load your businesses.", { cause: error });
  const choices = (data as unknown as OrganizationChoiceRow[]).filter(({ organizations }) => organizations !== null);
  if (choices.length === 0) redirect("/onboarding/business");
  if (choices.length === 1) {
    const destination = await resolveOnboardingDestination(supabase, user.id, choices[0].organization_id);
    redirect(destination.path);
  }

  return (
    <main id="negosu-business-selector-page" className="min-h-dvh overflow-y-auto bg-brand-tint px-4 py-8 sm:px-6 sm:py-12">
      <section id="negosu-business-selector" className="mx-auto w-full max-w-2xl">
        <BrandWordmark className="mb-6 w-32" />
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-primary text-white"><Building2 aria-hidden="true" size={21} /></span>
          <div><p className="text-sm font-bold text-brand-primary-strong">Your account</p><h1 className="text-3xl font-black tracking-tight">Choose Business</h1></div>
        </div>
        <p className="mb-6 text-sm leading-6 text-zinc-600">Choose the business you want to manage. Your data, navigation, and permissions will follow this selection.</p>
        <FormMessage error={params.error} />
        <div className="space-y-3">
          {choices.map((choice) => {
            const organization = choice.organizations!;
            const entry = resolveProductEntry(organization.industry ?? "automotive");
            const Icon = entry.industry === "salon" ? Scissors : Wrench;
            const hasActiveBranch = organization.branches.some(({ is_active: isActive }) => isActive);
            return (
              <form id={`negosu-business-option-${choice.organization_id}`} action={chooseOrganization} key={choice.organization_id} className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
                <input type="hidden" name="organizationId" value={choice.organization_id} />
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100"><Icon aria-hidden="true" size={19} /></span>
                  <div className="min-w-0"><h2 className="truncate font-black">{organization.name}</h2><p className="mt-1 text-sm text-zinc-600">{entry.productName} · {choice.role}</p>{!hasActiveBranch ? <p className="mt-1 text-xs font-semibold text-amber-700">Branch setup needs attention</p> : null}</div>
                </div>
                <SubmitButton id={`negosu-business-option-${choice.organization_id}-select-button`} pendingText="Opening…" className="mt-4 w-full gap-2 sm:mt-0 sm:w-auto">Open <Check aria-hidden="true" size={16} /></SubmitButton>
              </form>
            );
          })}
        </div>
      </section>
    </main>
  );
}
