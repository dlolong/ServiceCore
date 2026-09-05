import Link from "next/link";
import { redirect } from "next/navigation";

import { signIn } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { resolveOptionalProductEntry } from "@/modules/platform/product-entry";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string; industry?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);
  const next = safeRedirectPath(params.next ?? null, "/dashboard");
  const entry = resolveOptionalProductEntry(params.industry);
  const contextQuery = entry ? `?industry=${entry.industry}` : "";

  return (
    <AuthShell id="negosu-login-page" industry={entry?.industry} title="Welcome back" description="Sign in to manage your business." footer={<>New here? <Link id="negosu-login-create-account-link" className="font-bold text-brand-primary-strong" href={`/signup${contextQuery}`}>Create an account</Link></>}>
      <FormMessage error={params.error} message={params.message} />
      <form id="negosu-login-form" action={signIn} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        {entry ? <input type="hidden" name="industry" value={entry.industry} /> : null}
        <label className="block text-sm font-semibold" htmlFor="negosu-login-email-input">Email address<Input id="negosu-login-email-input" required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label>
        <label className="block text-sm font-semibold" htmlFor="negosu-login-password-input">Password<Input id="negosu-login-password-input" required autoComplete="current-password" name="password" type="password" className="mt-2" /></label>
        <div className="text-right"><Link id="negosu-login-forgot-password-link" href={`/forgot-password${contextQuery}`} className="text-sm font-semibold text-brand-primary-strong">Forgot password?</Link></div>
        <SubmitButton id="negosu-login-submit-button" className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
