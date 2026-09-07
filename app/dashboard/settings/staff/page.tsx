import Link from "next/link";
import { Plus } from "lucide-react";

import { revokeInvitation } from "@/app/dashboard/settings/staff/actions";
import { FormMessage } from "@/components/form-message";
import { FormDialog } from "@/components/management-ui";
import { PageHeader } from "@/components/page-patterns";
import {
  PermissionMatrix,
  StaffAccessForm,
  StaffDirectoryViews,
  StaffProfileForm,
  type StaffBranch,
  type StaffManagementIndustry,
  type StaffProfileRow,
} from "@/components/staff-management";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";
import { zonedDateTimeToUtc } from "@/lib/operations";
import { staffRoleLabelForIndustry } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  listOperationalStaffDirectory,
  listStaffScheduleAssignments,
  loadStaffManagementDirectory,
  type StaffManagementDirectory,
  type StaffScheduleAssignment,
} from "@/modules/core/staff/staff.runtime";

type Params = {
  dialog?: "create" | "edit" | "access";
  staffId?: string;
  message?: string;
  error?: string;
  invite?: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export default async function StaffPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [parameters, { activeMembership }, supabase] = await Promise.all([searchParams, getDashboardContext(), createClient()]);
  const industry: StaffManagementIndustry = activeMembership.industry === "salon" ? "salon" : "automotive";
  const prefix = industry === "salon" ? "salon-staff" : "staff";

  if (activeMembership.role !== "owner" && industry === "salon") {
    return <SalonStaffDailySchedule organizationId={activeMembership.organizationId} branchId={activeMembership.branchId} branchName={activeMembership.branchName} timezone={activeMembership.timezone}/>;
  }
  if (activeMembership.role !== "owner") return <main id={`${prefix}-page`} className="mx-auto max-w-4xl"><PageHeader id={`${prefix}-page-header`} eyebrow="Organization team" title="Staff"/><Card className="mt-6 p-6">Only organization owners can manage Staff profiles and system access.</Card></main>;

  const window = localDayWindow(activeMembership.timezone);
  const [staffResult, branchResult, invitationResult, assignmentResult] = await Promise.all([
    loadStaffManagementDirectory(activeMembership.organizationId)
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: { items: [] as StaffProfileRow[], supportsIndependentProfiles: true } satisfies StaffManagementDirectory, error: true })),
    supabase.from("branches").select("id,name").eq("organization_id", activeMembership.organizationId).eq("is_active", true).order("name"),
    supabase.from("staff_invitations").select("id,email,role,status,expires_at,created_at").eq("organization_id", activeMembership.organizationId).order("created_at", { ascending: false }),
    listStaffScheduleAssignments({
      organizationId: activeMembership.organizationId,
      branchId: activeMembership.branchId,
      startsAt: window.start.toISOString(),
      endsAt: window.end.toISOString(),
    }).then((data) => ({ data, error: false })).catch(() => ({ data: [] as StaffScheduleAssignment[], error: true })),
  ]);
  const profileManagementAvailable = staffResult.data.supportsIndependentProfiles;
  const branches = (branchResult.data ?? []) as StaffBranch[];
  const schedules = scheduleByStaff(assignmentResult.data);
  const staff = staffResult.data.items.map((profile) => ({
    ...profile,
    branchIds: profile.branchIds ?? [],
    accessBranchIds: profile.accessBranchIds ?? [],
    specializations: profile.specializations ?? [],
    todayCount: schedules.get(profile.id)?.count ?? 0,
    nextAt: schedules.get(profile.id)?.next ?? null,
  }));
  const selected = staff.find(({ id }) => id === parameters.staffId);
  const selectionError = !profileManagementAvailable && parameters.dialog
    ? "Staff profile tools are temporarily unavailable while this workspace is being updated."
    : (parameters.dialog === "edit" || parameters.dialog === "access") && !selected
    ? "Staff profile not found."
    : parameters.dialog === "access" && selected?.role === "owner" ? "Owner system access is protected." : undefined;
  const loadError = staffResult.error || branchResult.error ? "Unable to load Staff profiles." : invitationResult.error || assignmentResult.error ? "Some Staff context could not be loaded." : undefined;

  return <main id={`${prefix}-page`} className="mx-auto min-w-0 max-w-7xl">
    <PageHeader id={`${prefix}-page-header`} eyebrow="Organization team" title="Staff" description="Manage operational Staff profiles independently from login access." action={profileManagementAvailable ? <Button id={`${prefix}-create-button`} asChild><Link href="/dashboard/settings/staff?dialog=create"><Plus size={17}/>Add Staff</Link></Button> : undefined}/>
    <FormMessage error={parameters.error ?? selectionError ?? loadError} message={parameters.message}/>
    {!profileManagementAvailable ? <Card id={`${prefix}-compatibility-notice`} className="mt-5 border-status-warning/25 bg-status-warning-tint p-4 text-sm text-status-warning">Staff records are available in read-only mode while profile tools are being updated. Existing staff and system access remain unchanged.</Card> : null}
    {parameters.invite ? <Card id={`${prefix}-invitation-link`} className="mt-5 border-brand-border bg-brand-tint p-5"><h2 className="font-semibold">Secure invitation link</h2><p className="mt-1 text-sm text-slate-600">Send this link only to the login email entered for this invitation. It expires automatically and can be used once.</p><code id={`${prefix}-invitation-link-value`} className="mt-3 block break-all rounded-lg bg-white p-3 text-sm">{parameters.invite}</code></Card> : null}

    <section id={`${prefix}-directory`} className="mt-5 rounded-2xl border border-admin-border bg-white p-4 shadow-sm sm:p-5"><div><h2 className="font-semibold">Staff directory</h2><p className="text-sm text-slate-600">Contact details are optional. Operational status and system access are managed separately.</p></div><StaffDirectoryViews staff={staff} branches={branches} timezone={activeMembership.timezone} industry={industry} prefix={prefix} managementAvailable={profileManagementAvailable}/></section>

    <InvitationHistory invitations={(invitationResult.data ?? []) as InvitationRow[]} timezone={activeMembership.timezone} industry={industry} prefix={prefix}/>
    <PermissionMatrix industry={industry} prefix={prefix}/>

    {profileManagementAvailable && parameters.dialog === "create" ? <FormDialog id={`${prefix}-create-dialog`} title="Add Staff" description="Create an operational profile now. Email, mobile, and login access are optional." closeHref="/dashboard/settings/staff" size="lg"><StaffProfileForm branches={branches} industry={industry} prefix={`${prefix}-create`}/></FormDialog> : null}
    {profileManagementAvailable && parameters.dialog === "edit" && selected ? <FormDialog id={`${prefix}-edit-dialog`} title={`Edit ${selected.fullName}`} description="Profile and operational availability are independent from login access." closeHref="/dashboard/settings/staff" size="lg"><StaffProfileForm profile={selected} branches={branches} industry={industry} prefix={`${prefix}-edit`}/></FormDialog> : null}
    {profileManagementAvailable && parameters.dialog === "access" && selected && selected.role !== "owner" ? <FormDialog id={`${prefix}-access-dialog`} title={`${selected.membershipId ? "Manage" : "Grant"} system access`} description={`Set login permissions for ${selected.fullName} without changing the Staff profile.`} closeHref="/dashboard/settings/staff" size="md"><StaffAccessForm profile={selected} branches={branches} industry={industry} prefix={`${prefix}-access`}/></FormDialog> : null}
  </main>;
}

async function SalonStaffDailySchedule({ organizationId, branchId, branchName, timezone }: {
  organizationId: string;
  branchId: string;
  branchName: string;
  timezone: string;
}) {
  const window = localDayWindow(timezone);
  const [staffResult, assignmentResult] = await Promise.all([
    listOperationalStaffDirectory(organizationId)
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: [], error: true })),
    listStaffScheduleAssignments({ organizationId, branchId, startsAt: window.start.toISOString(), endsAt: window.end.toISOString() })
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: [] as StaffScheduleAssignment[], error: true })),
  ]);
  const schedule = scheduleTimesByStaff(assignmentResult.data);
  const staff = staffResult.data.filter((profile) => !profile.branchIds.length || profile.branchIds.includes(branchId));
  return <main id="salon-staff-page" className="mx-auto min-w-0 max-w-6xl"><PageHeader id="salon-staff-page-header" eyebrow={branchName} title="Staff daily schedule" description="Today’s Salon assignment context. Organization owners manage profiles and system access."/>
    <FormMessage error={staffResult.error || assignmentResult.error ? "Unable to load the Staff schedule." : undefined}/>
    <div id="salon-staff-today-schedule" className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{staff.map((profile) => { const visits = schedule.get(profile.staffId) ?? [];return <Card id={`salon-staff-schedule-${profile.staffId}`} key={profile.staffId} className="min-w-0 p-4"><div className="flex justify-between gap-3"><span className="min-w-0"><strong className="block truncate">{profile.fullName}</strong><small className="block truncate text-slate-500">{profile.jobFunction ?? "Staff"}</small></span><strong>{visits.length}</strong></div><p className="mt-3 text-sm text-slate-600">{visits.length ? visits.map((value) => formatTime(value, timezone)).join(" · ") : "Available — no assigned visits"}</p></Card>;})}</div>
  </main>;
}

function InvitationHistory({ invitations, timezone, industry, prefix }: { invitations: InvitationRow[]; timezone: string; industry: StaffManagementIndustry; prefix: string }) {
  return <section id={`${prefix}-invitations`} className="mt-5 rounded-2xl border border-admin-border bg-white p-5 shadow-sm"><h2 className="font-semibold">System access invitations</h2><p className="mt-1 text-sm text-slate-600">Invitation history is retained separately from Staff contact details.</p><div className="mt-3 divide-y divide-slate-100">{invitations.length ? invitations.map((invitation) => <div id={`${prefix}-invitation-${invitation.id}`} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3" key={invitation.id}><span className="min-w-0"><strong className="block truncate">{invitation.email}</strong><small className="block text-slate-500">{staffRoleLabelForIndustry(invitation.role, industry)} · <span className="capitalize">{invitation.status}</span> · expires {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(invitation.expires_at))}</small></span>{invitation.status === "pending" ? <form action={revokeInvitation}><input type="hidden" name="invitationId" value={invitation.id}/><SubmitButton id={`${prefix}-revoke-invitation-${invitation.id}`} pendingText="Revoking…" variant="destructive" size="sm">Revoke</SubmitButton></form> : null}</div>) : <p className="py-4 text-sm text-slate-500">No system access invitations yet.</p>}</div></section>;
}

function scheduleByStaff(rows: StaffScheduleAssignment[]) {
  const result = new Map<string, { count: number; next: string | null }>();
  for (const row of rows) {
    const appointment = row.appointment;
    if (!appointment?.starts_at) continue;
    const current = result.get(row.staffId) ?? { count: 0, next: null };
    current.count += 1;
    if (Date.parse(appointment.starts_at) > Date.now() && (!current.next || appointment.starts_at < current.next)) current.next = appointment.starts_at;
    result.set(row.staffId, current);
  }
  return result;
}

function scheduleTimesByStaff(rows: StaffScheduleAssignment[]) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const appointment = row.appointment;
    if (!appointment?.starts_at) continue;
    result.set(row.staffId, [...(result.get(row.staffId) ?? []), appointment.starts_at].sort());
  }
  return result;
}

function localDayWindow(timezone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return { start: zonedDateTimeToUtc(`${today}T00:00`, timezone)!, end: zonedDateTimeToUtc(`${nextDay}T00:00`, timezone)! };
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
