import Link from "next/link";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Reset your password" description="We will email you a secure reset link." footer={<Link className="font-bold text-amber-700" href="/sign-in">Back to sign in</Link>}><FormMessage error={params.error} message={params.message} /><form action={requestPasswordReset} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Email<Input required autoComplete="email" name="email" type="email" className="mt-2" /></label><Button className="w-full" type="submit">Send reset link</Button></form></AuthShell>;
}
