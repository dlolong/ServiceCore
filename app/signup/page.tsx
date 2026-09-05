import Link from "next/link";
import { redirect } from "next/navigation";

import { signUp } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { BusinessTypeSelector } from "@/components/business-type-selector";
import { FormMessage } from "@/components/form-message";
import { PasswordFields } from "@/components/password-fields";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { productBrand } from "@/modules/platform/brand";
import { resolveOptionalProductEntry } from "@/modules/platform/product-entry";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; industry?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);
  const entry = resolveOptionalProductEntry(params.industry);
  const contextQuery = entry ? `?industry=${entry.industry}` : "";

  return (
    <AuthShell id="negosu-signup-page" industry={entry?.industry} title="Create your account" description={entry?.signupDescription ?? `Create your ${productBrand.name} account and choose the business you want to manage.`} footer={<>Already registered? <Link id="negosu-signup-login-link" className="font-bold text-brand-primary-strong" href={`/login${contextQuery}`}>Sign in</Link></>}>
      <FormMessage error={params.error} />
      <form id="negosu-signup-form" action={signUp} className="mt-6 space-y-4">
        <BusinessTypeSelector idPrefix="negosu" initialIndustry={entry?.industry} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold" htmlFor="negosu-signup-first-name-input">First name<Input id="negosu-signup-first-name-input" required maxLength={60} autoComplete="given-name" name="firstName" className="mt-2" /></label>
          <label className="block text-sm font-semibold" htmlFor="negosu-signup-last-name-input">Last name<Input id="negosu-signup-last-name-input" required maxLength={60} autoComplete="family-name" name="lastName" className="mt-2" /></label>
        </div>
        <label className="block text-sm font-semibold" htmlFor="negosu-signup-email-input">Email address<Input id="negosu-signup-email-input" required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label>
        <PasswordFields idPrefix="negosu-signup" />
        <SubmitButton id="negosu-signup-submit-button" className="w-full" pendingText="Creating account…">Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
