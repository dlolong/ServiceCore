import Link from "next/link";
import { KeyRound, Pencil } from "lucide-react";

import {
  createStaffProfileInvitation,
  saveStaffProfile,
  updateStaffProfileAccess,
} from "@/app/dashboard/settings/staff/actions";
import {
  staffAccessStatusLabel,
  staffContactLabel,
  staffJobFunctionSuggestions,
} from "@/app/dashboard/settings/staff/staff-forms";
import { SubmitButton } from "@/components/submit-button";
import { StaffBranchFieldset as BranchFieldset } from "@/components/staff-branch-fieldset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayPhone } from "@/lib/crm";
import { staffRoleLabelForIndustry, staffRoleOptionsForIndustry } from "@/lib/rbac";
import type { StaffManagementItem } from "@/modules/core/staff";

export type StaffManagementIndustry = "automotive" | "salon";

export type StaffProfileRow = StaffManagementItem & {
  todayCount?: number;
  nextAt?: string | null;
};

export type StaffBranch = { id: string; name: string };

const automotivePermissions = [
  ["Owner", "Manage", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Manager", "Manage", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Service Advisor", "Manage", "Manage", "Manage", "—", "—", "—"],
  ["Technician", "Read", "—", "Assigned", "—", "—", "—"],
  ["Cashier", "Read", "—", "—", "Manage", "—", "—"],
  ["Viewer", "Read", "—", "—", "—", "—", "—"],
] as const;

const salonPermissions = [
  ["Owner", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Manager", "Manage", "Manage", "Manage", "Manage", "Manage"],
  ["Front Desk / Coordinator", "Manage", "Manage", "Manage", "—", "—"],
  ["Service Provider", "Read", "Assigned", "Read", "—", "—"],
  ["Cashier", "Read", "—", "Read", "—", "—"],
  ["Viewer", "Read", "Read", "Read", "—", "—"],
] as const;

export function StaffProfileForm({ profile, branches, industry, prefix }: {
  profile?: StaffProfileRow;
  branches: StaffBranch[];
  industry: StaffManagementIndustry;
  prefix: string;
}) {
  const suggestions = staffJobFunctionSuggestions[industry];
  return <form id={`${prefix}-form`} action={saveStaffProfile} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="staffId" value={profile?.id ?? ""}/>
    <label className="text-sm font-semibold sm:col-span-2">Full name <span aria-hidden="true">*</span>
      <Input id={`${prefix}-name-input`} name="fullName" required maxLength={120} defaultValue={profile?.fullName ?? ""} className="mt-2" autoComplete="name"/>
    </label>
    <label className="text-sm font-semibold">Email <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-email-input`} name="email" type="email" maxLength={254} defaultValue={profile?.email ?? ""} className="mt-2" autoComplete="email"/>
      <span className="mt-1 block text-xs font-normal text-slate-500">Optional — used for Staff notifications or account invitations when available.</span>
    </label>
    <label className="text-sm font-semibold">Mobile <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-mobile-input`} name="mobile" type="tel" inputMode="tel" maxLength={40} defaultValue={profile?.mobile ?? ""} placeholder="09xx xxx xxxx" className="mt-2" autoComplete="tel"/>
      <span className="mt-1 block text-xs font-normal text-slate-500">Optional — used for Staff notifications when available.</span>
    </label>
    <p className="-mt-2 text-xs text-slate-500 sm:col-span-2">Contact details are optional and do not create a login. System access is managed separately.</p>
    <label className="text-sm font-semibold">Job function <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-job-function-input`} name="jobFunction" list={`${prefix}-job-function-suggestions`} maxLength={80} defaultValue={profile?.jobFunction ?? ""} className="mt-2" placeholder={industry === "salon" ? "e.g. Senior Stylist" : "e.g. Master Technician"}/>
      <datalist id={`${prefix}-job-function-suggestions`}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion}/>)}</datalist>
    </label>
    <label className="text-sm font-semibold">Specialties <span className="font-normal text-slate-500">(optional)</span>
      <Input id={`${prefix}-specializations-input`} name="specializations" maxLength={1_000} defaultValue={profile?.specializations.join(", ") ?? ""} className="mt-2" placeholder={industry === "salon" ? "Hair color, facials" : "Diagnostics, electrical"}/>
    </label>
    <label className="text-sm font-semibold">Operational status
      <select id={`${prefix}-status-select`} name="isActive" defaultValue={String(profile?.isActive ?? true)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
        <option value="true">Active</option><option value="false">Inactive</option>
      </select>
    </label>
    <div className="hidden sm:block"/>
    <BranchFieldset id={`${prefix}-branches`} branches={branches} selected={profile?.branchIds ?? []} label="Operational branches"/>
    <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
      <Button id={`${prefix}-cancel-button`} asChild variant="secondary"><Link href="/dashboard/settings/staff">Cancel</Link></Button>
      <SubmitButton id={`${prefix}-save-button`} pendingText="Saving…">{profile ? "Save profile" : "Add staff"}</SubmitButton>
    </div>
  </form>;
}

export function StaffAccessForm({ profile, branches, industry, prefix }: {
  profile: StaffProfileRow;
  branches: StaffBranch[];
  industry: StaffManagementIndustry;
  prefix: string;
}) {
  const roleOptions = staffRoleOptionsForIndustry(industry);
  const linked = Boolean(profile.membershipId);
  const selectedBranches = profile.accessBranchIds ?? [];
  if (!linked) return <form id={`${prefix}-form`} action={createStaffProfileInvitation} className="grid gap-4">
    <input type="hidden" name="staffId" value={profile.id}/>
    <label className="text-sm font-semibold">Login email
      <Input id={`${prefix}-login-email-input`} name="loginEmail" type="email" required maxLength={254} defaultValue={profile.email ?? ""} className="mt-2" autoComplete="email"/>
      <span className="mt-1 block text-xs font-normal text-slate-500">This identifies the account that may accept the invitation. It can differ from the Staff contact email.</span>
    </label>
    <RoleSelect id={`${prefix}-role-select`} name="role" defaultValue={profile.role ?? "viewer"} industry={industry}/>
    <BranchFieldset id={`${prefix}-branches`} branches={branches} selected={selectedBranches} label="System access branches"/>
    <label className="text-sm font-semibold">Invitation expires in
      <select id={`${prefix}-expiry-select`} name="expiresHours" defaultValue="72" className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
        <option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option>
      </select>
    </label>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button id={`${prefix}-cancel-button`} asChild variant="secondary"><Link href="/dashboard/settings/staff">Cancel</Link></Button>
      <SubmitButton id={`${prefix}-save-button`} pendingText="Creating…">{profile.systemAccessStatus === "pending" ? "Replace invitation" : "Create invitation"}</SubmitButton>
    </div>
  </form>;

  return <form id={`${prefix}-form`} action={updateStaffProfileAccess} className="grid gap-4">
    <input type="hidden" name="staffId" value={profile.id}/>
    <RoleSelect id={`${prefix}-role-select`} name="role" defaultValue={profile.role ?? roleOptions[0]?.value ?? "viewer"} industry={industry}/>
    <label className="text-sm font-semibold">System access status
      <select id={`${prefix}-status-select`} name="isActive" defaultValue={profile.systemAccessStatus === "active" ? "true" : "false"} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
        <option value="true">Active</option><option value="false">Disabled</option>
      </select>
      <span className="mt-1 block text-xs font-normal text-slate-500">This changes login access only. The Staff profile remains available according to its operational status.</span>
    </label>
    <BranchFieldset id={`${prefix}-branches`} branches={branches} selected={selectedBranches} label="System access branches"/>
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button id={`${prefix}-cancel-button`} asChild variant="secondary"><Link href="/dashboard/settings/staff">Cancel</Link></Button>
      <SubmitButton id={`${prefix}-save-button`} pendingText="Saving…">Save system access</SubmitButton>
    </div>
  </form>;
}

export function StaffDirectoryViews({ staff, branches, timezone, industry, prefix, managementAvailable = true }: {
  staff: StaffProfileRow[];
  branches: StaffBranch[];
  timezone: string;
  industry: StaffManagementIndustry;
  prefix: string;
  managementAvailable?: boolean;
}) {
  const tableContainerId = industry === "salon" ? "salon-staff-table-container" : "staff-table-container";
  const tableId = industry === "salon" ? "salon-staff-table" : "staff-table";
  const mobileListId = industry === "salon" ? "salon-staff-mobile-list" : "staff-mobile-list";
  if (!staff.length) return <div id={`${prefix}-empty-state`} className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
    <h2 className="font-semibold">No Staff profiles yet</h2><p className="mt-1 text-sm text-slate-600">{managementAvailable ? "Add a Staff profile now. Login access can be granted later." : "Staff profiles will appear here when available."}</p>
  </div>;
  return <>
    <div id={tableContainerId} className="mt-4 hidden overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm md:block">
      <table id={tableId} className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Function</th><th className="px-3 py-2">Today / Next</th><th className="px-3 py-2">Profile</th><th className="px-3 py-2">System access</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{staff.map((profile) => <tr id={`${prefix}-row-${profile.id}`} key={profile.id} className="align-top hover:bg-blue-50/70">
          <td className="min-w-48 px-3 py-3"><strong>{profile.fullName}</strong><StaffContactLines profile={profile}/><small className="block text-slate-500">{branchNames(profile.branchIds, branches)}</small></td>
          <td className="px-3 py-3"><strong>{profile.jobFunction || "Not set"}</strong><small className="block max-w-48 text-slate-500">{profile.specializations.join(", ") || "No specialties"}</small></td>
          <td className="px-3 py-3"><strong>{profile.todayCount ?? 0} appointment{profile.todayCount === 1 ? "" : "s"}</strong><small className="block text-slate-500">{profile.nextAt ? `Next ${formatTime(profile.nextAt, timezone)}` : "No upcoming visit"}</small></td>
          <td className="px-3 py-3"><ProfileStatus active={profile.isActive}/></td>
          <td className="px-3 py-3"><AccessStatus id={`${prefix}-access-status-${profile.id}`} profile={profile} industry={industry}/></td>
          <td className="px-3 py-3"><StaffActions profile={profile} prefix={prefix} managementAvailable={managementAvailable}/></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div id={mobileListId} className="mt-4 grid min-w-0 gap-3 md:hidden">{staff.map((profile) => <article id={`${prefix}-card-${profile.id}`} key={profile.id} className="min-w-0 rounded-2xl border border-admin-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{profile.fullName}</h2><p className="truncate text-sm text-slate-600">{profile.jobFunction || "Job function not set"}</p></div><ProfileStatus active={profile.isActive}/></div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs"><div className="min-w-0"><p className="text-slate-500">Contact</p><StaffContactLines profile={profile} mobile/></div><div><p className="text-slate-500">Today / Next</p><p className="font-semibold">{profile.todayCount ?? 0} appointment{profile.todayCount === 1 ? "" : "s"}</p><p className="font-semibold">{profile.nextAt ? formatTime(profile.nextAt, timezone) : "No upcoming visit"}</p></div></div>
      <div className="mt-3 border-t border-slate-100 pt-3"><AccessStatus id={`${prefix}-access-status-${profile.id}-mobile`} profile={profile} industry={industry}/><p className="mt-2 truncate text-xs text-slate-500">{branchNames(profile.branchIds, branches)}</p></div>
      <div className="mt-3"><StaffActions profile={profile} prefix={`${prefix}-mobile`} managementAvailable={managementAvailable}/></div>
    </article>)}</div>
  </>;
}

export function PermissionMatrix({ industry, prefix }: { industry: StaffManagementIndustry; prefix: string }) {
  const headings = industry === "salon" ? ["Access role", "Clients", "Appointments", "Treatments", "Inventory", "Settings"] : ["Access role", "Customers", "Appointments", "Jobs", "Finance", "Inventory", "Settings"];
  const rows = industry === "salon" ? salonPermissions : automotivePermissions;
  return <section id={`${prefix}-permission-matrix`} className="mt-5 rounded-2xl border border-admin-border bg-white p-5 shadow-sm"><h2 className="font-semibold">Permission matrix</h2>
    <div className="mt-4 hidden overflow-hidden rounded-xl border md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{headings.map((heading) => <th className="px-3 py-2" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className="px-3 py-2" key={`${row[0]}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>
    <div className="mt-3 grid gap-2 md:hidden">{rows.map((row) => <details className="rounded-xl border p-3" key={row[0]}><summary className="cursor-pointer font-bold">{row[0]}</summary><dl className="mt-2 grid grid-cols-2 gap-2 text-xs">{headings.slice(1).map((heading, index) => <div key={heading}><dt className="text-slate-500">{heading}</dt><dd className="font-semibold">{row[index + 1]}</dd></div>)}</dl></details>)}</div>
  </section>;
}

function RoleSelect({ id, name, defaultValue, industry }: { id: string; name: string; defaultValue: string; industry: StaffManagementIndustry }) {
  return <label className="text-sm font-semibold">Access role
    <select id={id} name={name} defaultValue={defaultValue} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">{staffRoleOptionsForIndustry(industry).map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select>
    <span className="mt-1 block text-xs font-normal text-slate-500">Permissions are separate from the Staff job function.</span>
  </label>;
}

function StaffActions({ profile, prefix, managementAvailable }: { profile: StaffProfileRow; prefix: string; managementAvailable: boolean }) {
  const owner = profile.role === "owner";
  if (!managementAvailable) return <span id={`${prefix}-read-only-${profile.id}`} className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-slate-500">Temporarily read-only</span>;
  return <div className="flex flex-wrap justify-end gap-2"><Button id={`${prefix}-edit-${profile.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/settings/staff?dialog=edit&staffId=${profile.id}`}><Pencil size={14}/>Edit</Link></Button>{owner ? <span className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-slate-500">Owner access protected</span> : <Button id={`${prefix}-access-${profile.id}`} asChild size="sm" variant="secondary"><Link href={`/dashboard/settings/staff?dialog=access&staffId=${profile.id}`}><KeyRound size={14}/>{profile.membershipId ? "Access" : "Grant access"}</Link></Button>}</div>;
}

function AccessStatus({ id, profile, industry }: { id: string; profile: StaffProfileRow; industry: StaffManagementIndustry }) {
  const status = profile.systemAccessStatus;
  const color = status === "active" ? "bg-emerald-100 text-emerald-800" : status === "pending" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700";
  return <div id={id}><span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${color}`}>{staffAccessStatusLabel(status)}</span><small className="mt-1 block text-slate-500">{profile.role ? staffRoleLabelForIndustry(profile.role, industry) : "No permission role"}</small></div>;
}

function ProfileStatus({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{active ? "Active" : "Inactive"}</span>;
}

function StaffContactLines({ profile, mobile = false }: { profile: StaffProfileRow; mobile?: boolean }) {
  const className = mobile ? "block truncate font-semibold" : "block text-slate-500";
  if (!profile.email && !profile.mobile) return <small className={className}>No contact details</small>;
  return <>
    <small className={className}>{staffContactLabel(profile.email, "No email")}</small>
    <small className={className}>{profile.mobile ? displayPhone(profile.mobile) : "No mobile"}</small>
  </>;
}

function branchNames(ids: string[], branches: StaffBranch[]) {
  if (!ids.length) return "All operational branches";
  return branches.filter((branch) => ids.includes(branch.id)).map((branch) => branch.name).join(", ") || "Restricted branches";
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
