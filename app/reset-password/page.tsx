import Link from "next/link";

import { updatePassword } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { PasswordFields } from "@/components/password-fields";
import { SubmitButton } from "@/components/submit-button";
import { getAuthenticatedUser } from "@/lib/auth/context";
import { resolveOptionalProductEntry } from "@/modules/platform/product-entry";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; industry?: string }> }) {
  const [params, auth] = await Promise.all([searchParams, getAuthenticatedUser()]);
  const entry = resolveOptionalProductEntry(params.industry);
  const contextQuery = entry ? `?industry=${entry.industry}` : "";
  if (!auth) {
    return <AuthShell id="negosu-reset-password-page" industry={entry?.industry} title="Reset link required" description="This password reset link is missing, invalid, expired, or has already been used." footer={<Link id="negosu-reset-password-request-link" className="font-bold text-brand-primary-strong" href={`/forgot-password${contextQuery}`}>Request a new reset link</Link>}><FormMessage error={params.error} /></AuthShell>;
  }

  return (
    <AuthShell id="negosu-reset-password-page" industry={entry?.industry} title="Choose a new password" description="Your recovery link is valid. Choose a new password for your account.">
      <FormMessage error={params.error} />
      <form id="negosu-reset-password-form" action={updatePassword} className="mt-6 space-y-4">
        {entry ? <input type="hidden" name="industry" value={entry.industry} /> : null}
        <PasswordFields current idPrefix="negosu-reset-password" />
        <SubmitButton id="negosu-reset-password-submit-button" className="w-full" pendingText="Updating password…">Update password</SubmitButton>
      </form>
    </AuthShell>
  );
}
