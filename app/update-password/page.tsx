import { updatePassword } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <AuthShell title="Choose a new password" description="Use at least 8 characters for your new password."><FormMessage error={error} /><form action={updatePassword} className="mt-6 space-y-4"><label className="block text-sm font-semibold">New password<Input required minLength={8} maxLength={72} autoComplete="new-password" name="password" type="password" className="mt-2" /></label><Button className="w-full" type="submit">Update password</Button></form></AuthShell>;
}
