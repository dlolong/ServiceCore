import Link from "next/link";
import { redirect } from "next/navigation";

import { signUp } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { PasswordFields } from "@/components/password-fields";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);

  return (
    <AuthShell title="Create your account" description="Start your KarKR workspace. You will set up your shop after verifying your email." footer={<>Already registered? <Link className="font-bold text-amber-700" href="/login">Sign in</Link></>}>
      <FormMessage error={error} />
      <form action={signUp} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">First name<Input required maxLength={60} autoComplete="given-name" name="firstName" className="mt-2" /></label>
          <label className="block text-sm font-semibold">Last name<Input required maxLength={60} autoComplete="family-name" name="lastName" className="mt-2" /></label>
        </div>
        <label className="block text-sm font-semibold">Email address<Input required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label>
        <PasswordFields />
        <SubmitButton className="w-full" pendingText="Creating account…">Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
