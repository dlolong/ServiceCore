import { redirect } from "next/navigation";

import { createOrganization } from "@/app/onboarding/actions";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAuthenticatedUser } from "@/lib/auth/context";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, { supabase, user }] = await Promise.all([searchParams, requireAuthenticatedUser("/onboarding")]);
  const { count } = await supabase.from("organization_memberships").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true);
  if (count && count > 0) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-5 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-bold text-amber-700">KarKR setup</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Tell us about your shop.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">This creates your organization, owner access, free plan, and first branch in one secure step.</p>
        <FormMessage error={error} />
        <form action={createOrganization} className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">Business name<Input required maxLength={120} name="businessName" placeholder="AutoShine Detailing" className="mt-2" /></label>
          <label className="block text-sm font-semibold">Shop URL<Input required maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="autoshine-detailing" className="mt-2" /><span className="mt-1 block text-xs font-normal text-zinc-500">Lowercase letters, numbers, and hyphens.</span></label>
          <label className="block text-sm font-semibold">Phone <span className="font-normal text-zinc-500">(optional)</span><Input maxLength={30} autoComplete="tel" name="phone" placeholder="+63 917 123 4567" className="mt-2" /></label>
          <div className="grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-2"><div><span className="block text-xs text-zinc-500">Currency</span><strong>PHP</strong></div><div><span className="block text-xs text-zinc-500">Timezone</span><strong>Asia/Manila</strong></div></div>
          <Button className="w-full" type="submit">Create my shop</Button>
        </form>
      </section>
    </main>
  );
}
