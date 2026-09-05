import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { resolveOptionalProductEntry } from "@/modules/platform/product-entry";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; industry?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);
  const entry = resolveOptionalProductEntry(params.industry);
  const contextQuery = entry ? `?industry=${entry.industry}` : "";
  return <AuthShell id="negosu-forgot-password-page" industry={entry?.industry} title="Reset your password" description="We will email you a secure reset link." footer={<Link id="negosu-forgot-password-login-link" className="font-bold text-brand-primary-strong" href={`/login${contextQuery}`}>Back to sign in</Link>}><FormMessage error={params.error} message={params.message} /><form id="negosu-forgot-password-form" action={requestPasswordReset} className="mt-6 space-y-4">{entry ? <input type="hidden" name="industry" value={entry.industry} /> : null}<label className="block text-sm font-semibold" htmlFor="negosu-forgot-password-email-input">Email address<Input id="negosu-forgot-password-email-input" required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label><SubmitButton id="negosu-forgot-password-submit-button" className="w-full" pendingText="Sending reset link…">Send reset link</SubmitButton></form></AuthShell>;
}
