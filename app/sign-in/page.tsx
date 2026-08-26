import Link from "next/link";

import { signIn } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeRedirectPath } from "@/lib/auth/redirect";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next ?? null, "/dashboard");
  return (
    <AuthShell title="Sign in" description="Welcome back. Sign in to your KarKR shop." footer={<>New to KarKR? <Link className="font-bold text-amber-700" href="/sign-up">Create an account</Link></>}>
      <FormMessage error={params.error} message={params.message} />
      <form action={signIn} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-semibold">Email<Input required autoComplete="email" name="email" type="email" className="mt-2" /></label>
        <label className="block text-sm font-semibold">Password<Input required autoComplete="current-password" name="password" type="password" className="mt-2" /></label>
        <div className="text-right"><Link href="/forgot-password" className="text-sm font-semibold text-amber-700">Forgot password?</Link></div>
        <Button className="w-full" type="submit">Sign in</Button>
      </form>
    </AuthShell>
  );
}
