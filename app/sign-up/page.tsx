import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell title="Create your account" description="Start your KarKR workspace. You will set up your shop after verifying your email." footer={<>Already registered? <Link className="font-bold text-amber-700" href="/sign-in">Sign in</Link></>}><FormMessage error={error} /><form action={signUp} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Full name<Input required autoComplete="name" name="fullName" className="mt-2" /></label><label className="block text-sm font-semibold">Email<Input required autoComplete="email" name="email" type="email" className="mt-2" /></label><label className="block text-sm font-semibold">Password<Input required minLength={8} maxLength={72} autoComplete="new-password" name="password" type="password" className="mt-2" /><span className="mt-1 block text-xs font-normal text-zinc-500">At least 8 characters.</span></label><Button className="w-full" type="submit">Create account</Button></form></AuthShell>;
}
