import { Check, Palette } from "lucide-react";

import { updateDashboardTheme, updateProfile } from "@/app/dashboard/settings/actions";
import { FormMessage } from "@/components/form-message";
import { PageHeader } from "@/components/page-patterns";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardContext } from "@/lib/auth/context";
import { dashboardThemes } from "@/modules/platform/dashboard-theme";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const [params, context] = await Promise.all([searchParams, getDashboardContext()]);
  return (
    <main id="settings-page" className="mx-auto min-w-0 max-w-5xl">
      <PageHeader id="settings-page-header" eyebrow="Settings" title="Profile and workspace" description="Manage your personal details, workspace appearance, and active business."/>
      <FormMessage error={params.error} message={params.message} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card id="settings-profile-section" elevation="none" className="p-5 sm:p-6"><h2 className="text-lg font-semibold">Your profile</h2><form id="settings-profile-form" action={updateProfile} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Full name<Input id="settings-profile-name-input" required maxLength={120} autoComplete="name" name="fullName" defaultValue={context.profile.fullName} className="mt-2" /></label><label className="block text-sm font-semibold">Phone<Input id="settings-profile-phone-input" maxLength={30} autoComplete="tel" name="phone" defaultValue={context.profile.phone} className="mt-2" /></label><label className="block text-sm font-semibold">Email<Input id="settings-profile-email-input" disabled value={context.user.email ?? ""} className="mt-2" /></label><Button id="settings-profile-save-button" type="submit">Save profile</Button></form></Card>
        <Card id="settings-organization-section" elevation="none" className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-admin-text">{context.activeMembership.organizationName}</h2><p className="mt-1 truncate text-sm text-admin-text-muted">/{context.activeMembership.organizationSlug}</p></div><Badge>{context.activeMembership.role}</Badge></div><dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-admin-text-muted">Branch</dt><dd className="mt-1 font-semibold text-admin-text">{context.activeMembership.branchName}</dd></div><div><dt className="text-admin-text-muted">Phone</dt><dd className="mt-1 font-semibold text-admin-text">{context.activeMembership.organizationPhone || "Not provided"}</dd></div><div><dt className="text-admin-text-muted">Currency</dt><dd className="mt-1 font-semibold text-admin-text">{context.activeMembership.currency}</dd></div><div><dt className="text-admin-text-muted">Timezone</dt><dd className="mt-1 break-words font-semibold text-admin-text">{context.activeMembership.timezone}</dd></div></dl><div className="mt-6 flex flex-wrap gap-2"><Button id="settings-manage-branches-button" asChild variant="secondary"><a href="/dashboard/settings/branches">Manage branches</a></Button>{context.activeMembership.role==="owner"&&<Button id="settings-manage-staff-button" asChild><a href="/dashboard/settings/staff">Manage staff</a></Button>}</div></Card>
        <Card id="settings-appearance-section" elevation="none" className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-ui-md bg-brand-tint text-brand-primary-strong"><Palette aria-hidden="true" size={20}/></span>
            <div><h2 className="text-lg font-semibold text-admin-text">Workspace color theme</h2><p id="settings-theme-help" className="mt-1 text-sm text-admin-text-secondary">Choose a professional accent palette for your account. Status colors remain consistent and the choice follows you across businesses.</p></div>
          </div>
          <form id="settings-theme-form" action={updateDashboardTheme} className="mt-5">
            <fieldset aria-describedby="settings-theme-help">
              <legend className="sr-only">Dashboard color theme</legend>
              <div id="settings-theme-options" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {dashboardThemes.map((theme) => {
                  return <label id={`settings-theme-option-${theme.id}`} key={theme.id} className="relative cursor-pointer rounded-ui-lg border border-admin-border bg-admin-surface p-4 transition-[border-color,box-shadow] has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary">
                    <input id={`settings-theme-radio-${theme.id}`} className="peer sr-only" type="radio" name="dashboardTheme" value={theme.id} defaultChecked={theme.id === context.profile.dashboardTheme}/>
                    <Check aria-hidden="true" className="absolute right-4 top-4 hidden text-brand-primary peer-checked:block" size={18}/>
                    <span className="block pr-6"><strong className="block text-sm text-admin-text">{theme.name}</strong><small className="mt-1 block leading-5 text-admin-text-muted">{theme.description}</small></span>
                    <span className="mt-4 flex gap-1.5" aria-hidden="true">{theme.swatches.map((color) => <span key={color} className="size-7 rounded-full border border-black/10" style={{backgroundColor: color}}/>)}</span>
                  </label>;
                })}
              </div>
            </fieldset>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-admin-text-muted">This changes dashboard colors only. Your public business page keeps its customer-facing branding.</p><SubmitButton id="settings-theme-save-button" pendingText="Applying theme…">Apply color theme</SubmitButton></div>
          </form>
        </Card>
      </div>
    </main>
  );
}
