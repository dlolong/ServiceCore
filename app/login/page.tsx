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

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (auth) redirect((await resolveOnboardingDestination(auth.supabase, auth.user.id)).path);
  const next = safeRedirectPath(params.next ?? null, "/dashboard");

  return (
    <AuthShell title="Sign in" description="Welcome back. Sign in to your KarKR shop." footer={<>New to KarKR? <Link className="font-bold text-amber-700" href="/signup">Create an account</Link></>}>
      <FormMessage error={params.error} message={params.message} />
      <form action={signIn} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold">Email address<Input required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label>
        <label className="block text-sm font-semibold">Password<Input required autoComplete="current-password" name="password" type="password" className="mt-2" /></label>
        <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-amber-700">Forgot password?</Link></div>
        <SubmitButton className="w-full" pendingText="Signing in…">Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
