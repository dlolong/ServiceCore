import { updateProfile } from "@/app/dashboard/settings/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [params, context] = await Promise.all([searchParams, getDashboardContext()]);
  return (
    <main id="settings-page" className="mx-auto min-w-0 max-w-4xl">
      <PageHeader id="settings-page-header" eyebrow="Settings" title="Profile and organization" description="Manage your personal details and review the active business."/>
      <FormMessage error={params.error} message={params.message} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card id="settings-profile-section" elevation="none" className="p-5 sm:p-6"><h2 className="text-lg font-black">Your profile</h2><form id="settings-profile-form" action={updateProfile} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Full name<Input id="settings-profile-name-input" required maxLength={120} autoComplete="name" name="fullName" defaultValue={context.profile.fullName} className="mt-2" /></label><label className="block text-sm font-semibold">Phone<Input id="settings-profile-phone-input" maxLength={30} autoComplete="tel" name="phone" defaultValue={context.profile.phone} className="mt-2" /></label><label className="block text-sm font-semibold">Email<Input id="settings-profile-email-input" disabled value={context.user.email ?? ""} className="mt-2" /></label><Button id="settings-profile-save-button" type="submit">Save profile</Button></form></Card>
        <Card id="settings-organization-section" elevation="none" className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-black">{context.activeMembership.organizationName}</h2><p className="mt-1 truncate text-sm text-zinc-500">/{context.activeMembership.organizationSlug}</p></div><Badge>{context.activeMembership.role}</Badge></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-zinc-500">Branch</dt><dd className="mt-1 font-semibold">{context.activeMembership.branchName}</dd></div><div><dt className="text-zinc-500">Phone</dt><dd className="mt-1 font-semibold">{context.activeMembership.organizationPhone || "Not provided"}</dd></div><div><dt className="text-zinc-500">Currency</dt><dd className="mt-1 font-semibold">{context.activeMembership.currency}</dd></div><div><dt className="text-zinc-500">Timezone</dt><dd className="mt-1 break-words font-semibold">{context.activeMembership.timezone}</dd></div></dl><div className="mt-6 flex flex-wrap gap-2"><Button id="settings-manage-branches-button" asChild variant="secondary"><a href="/dashboard/settings/branches">Manage branches</a></Button>{context.activeMembership.role==="owner"&&<Button id="settings-manage-staff-button" asChild><a href="/dashboard/settings/staff">Manage staff</a></Button>}</div></Card>
      </div>
    </main>
  );
}
