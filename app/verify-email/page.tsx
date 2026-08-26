import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <AuthShell title="Check your email" description={`We sent a verification link${email ? ` to ${email}` : ""}. Open it to verify your account and continue setting up your shop.`} footer={<Link className="font-bold text-amber-700" href="/sign-in">Back to sign in</Link>}><p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">The link may take a minute to arrive. Check your spam folder if you do not see it.</p></AuthShell>;
}
