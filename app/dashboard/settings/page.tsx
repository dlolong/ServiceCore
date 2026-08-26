import { updateProfile } from "@/app/dashboard/settings/actions";
import { FormMessage } from "@/components/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [params, context] = await Promise.all([searchParams, getDashboardContext()]);
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold text-amber-700">Settings</p><h1 className="mt-1 text-3xl font-black tracking-tight">Profile and organization</h1><p className="mt-2 text-zinc-600">Manage your personal details and review the active shop.</p>
      <FormMessage error={params.error} message={params.message} />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-6"><h2 className="text-lg font-black">Your profile</h2><form action={updateProfile} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Full name<Input required maxLength={120} autoComplete="name" name="fullName" defaultValue={context.profile.fullName} className="mt-2" /></label><label className="block text-sm font-semibold">Phone<Input maxLength={30} autoComplete="tel" name="phone" defaultValue={context.profile.phone} className="mt-2" /></label><label className="block text-sm font-semibold">Email<Input disabled value={context.user.email ?? ""} className="mt-2" /></label><Button type="submit">Save profile</Button></form></Card>
        <Card className="p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black">{context.activeMembership.organizationName}</h2><p className="mt-1 text-sm text-zinc-500">/{context.activeMembership.organizationSlug}</p></div><Badge>{context.activeMembership.role}</Badge></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-zinc-500">Branch</dt><dd className="mt-1 font-semibold">{context.activeMembership.branchName}</dd></div><div><dt className="text-zinc-500">Phone</dt><dd className="mt-1 font-semibold">{context.activeMembership.organizationPhone || "Not provided"}</dd></div><div><dt className="text-zinc-500">Currency</dt><dd className="mt-1 font-semibold">{context.activeMembership.currency}</dd></div><div><dt className="text-zinc-500">Timezone</dt><dd className="mt-1 font-semibold">{context.activeMembership.timezone}</dd></div></dl><p className="mt-6 text-xs leading-5 text-zinc-500">Organization and staff administration expands in Phase 09.</p></Card>
      </div>
    </div>
  );
}
