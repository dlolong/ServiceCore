import Link from "next/link";

import { updatePassword } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { PasswordFields } from "@/components/password-fields";
import { SubmitButton } from "@/components/submit-button";
import { getAuthenticatedUser } from "@/lib/auth/context";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  if (!auth) {
    return <AuthShell title="Reset link required" description="This password reset link is missing, invalid, expired, or has already been used." footer={<Link className="font-bold text-amber-700" href="/forgot-password">Request a new reset link</Link>}><FormMessage error={error} /></AuthShell>;
  }

  return (
    <AuthShell title="Choose a new password" description="Your recovery link is valid. Choose a new password for your account.">
      <FormMessage error={error} />
      <form action={updatePassword} className="mt-6 space-y-4">
        <PasswordFields current />
        <SubmitButton className="w-full" pendingText="Updating password…">Update password</SubmitButton>
      </form>
    </AuthShell>
  );
}
