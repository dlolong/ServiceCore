import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);
  return <AuthShell title="Reset your password" description="We will email you a secure reset link." footer={<Link className="font-bold text-amber-700" href="/login">Back to sign in</Link>}><FormMessage error={params.error} message={params.message} /><form action={requestPasswordReset} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Email address<Input required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label><SubmitButton className="w-full" pendingText="Sending reset link…">Send reset link</SubmitButton></form></AuthShell>;
}
