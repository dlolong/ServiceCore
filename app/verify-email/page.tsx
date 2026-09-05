import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { resolveOptionalProductEntry } from "@/modules/platform/product-entry";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; industry?: string }> }) {
  const { email, industry } = await searchParams;
  const entry = resolveOptionalProductEntry(industry);
  const contextQuery = entry ? `?industry=${entry.industry}` : "";
  return <AuthShell id="negosu-verify-email-page" industry={entry?.industry} title="Check your email" description={`We sent a verification link${email ? ` to ${email}` : ""}. Open it to verify your account and continue setting up your business.`} footer={<Link id="negosu-verify-email-login-link" className="font-bold text-brand-primary-strong" href={`/login${contextQuery}`}>Back to sign in</Link>}><p id="negosu-verify-email-guidance" className="mt-6 rounded-xl border border-brand-border bg-brand-tint p-4 text-sm leading-6 text-brand-ink">The link may take a minute to arrive. Check your spam folder if you do not see it.</p></AuthShell>;
}
