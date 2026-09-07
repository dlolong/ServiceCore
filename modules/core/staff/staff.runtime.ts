import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isMissingAppointmentStaffProfileId,
  isMissingStaffDirectory,
  isMissingStaffProfilesRpc,
} from "@/lib/supabase/schema-compatibility";
import type { z } from "zod";
import type { saveStaffProfileInputSchema, staffProfileInvitationInputSchema, updateStaffProfileAccessInputSchema } from "@/modules/core/staff/staff.service";
import { StaffProfileError } from "@/modules/core/staff/staff.service";
import type { StaffManagementItem } from "@/modules/core/staff/staff.types";

export type StaffManagementDirectory = {
  items: StaffManagementItem[];
  supportsIndependentProfiles: boolean;
};

type LegacyStaffRow = {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  role: StaffManagementItem["role"];
  is_active: boolean;
  branch_ids: string[] | null;
  created_at: string;
};

type LegacyStaffProfileRow = {
  membership_id: string;
  job_function: string | null;
  specializations: string[] | null;
};

type AppointmentRow = {
  id: string;
  branch_id: string;
  starts_at: string | null;
  status: string;
};

export type OperationalStaffDirectoryItem = {
  staffId: string;
  fullName: string;
  jobFunction: string | null;
  specializations: string[];
  isActive: boolean;
  branchIds: string[];
  hasLogin: boolean;
};

export type StaffScheduleAssignment = {
  staffId: string;
  appointment: AppointmentRow | null;
};

function fail(error: { message: string } | null, fallback: string): never {
  const safe = ["staff", "branch", "invitation", "access", "email", "mobile"];
  throw new StaffProfileError(error && safe.some((term) => error.message.toLowerCase().includes(term)) ? error.message : fallback);
}

export async function loadStaffManagementDirectory(organizationId: string): Promise<StaffManagementDirectory> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_staff_profiles", { p_organization_id: organizationId });
  if (!error) return {
    items: mapCurrentStaffProfiles(data ?? []),
    supportsIndependentProfiles: true,
  };
  if (!isMissingStaffProfilesRpc(error)) fail(error, "Unable to load Staff.");

  // Rolling development environments may briefly remain on the pre-optional-
  // profile model. Its SECURITY DEFINER directory still enforces staff.manage.
  const [legacyStaffResult, legacyProfileResult] = await Promise.all([
    supabase.rpc("list_staff", { p_organization_id: organizationId }),
    supabase.from("organization_staff_profiles")
      .select("membership_id,job_function,specializations")
      .eq("organization_id", organizationId),
  ]);
  if (legacyStaffResult.error) fail(legacyStaffResult.error, "Unable to load Staff.");
  if (legacyProfileResult.error) fail(legacyProfileResult.error, "Unable to load Staff profiles.");

  return {
    items: mapLegacyStaffProfiles(
      organizationId,
      (legacyStaffResult.data ?? []) as LegacyStaffRow[],
      (legacyProfileResult.data ?? []) as LegacyStaffProfileRow[],
    ),
    supportsIndependentProfiles: false,
  };
}

export async function listStaffProfiles(organizationId: string): Promise<StaffManagementItem[]> {
  return (await loadStaffManagementDirectory(organizationId)).items;
}

export async function listOperationalStaffDirectory(organizationId: string): Promise<OperationalStaffDirectoryItem[]> {
  const supabase = await createClient();
  const canonical = await supabase.from("staff_directory")
    .select("staff_id,full_name,job_function,specializations,is_active,branch_ids,has_login")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (!canonical.error) return (canonical.data ?? []).map((row: Record<string, unknown>) => ({
    staffId: String(row.staff_id),
    fullName: String(row.full_name),
    jobFunction: row.job_function ? String(row.job_function) : null,
    specializations: (row.specializations as string[] | null) ?? [],
    isActive: Boolean(row.is_active),
    branchIds: (row.branch_ids as string[] | null) ?? [],
    hasLogin: Boolean(row.has_login),
  }));
  if (!isMissingStaffDirectory(canonical.error)) fail(canonical.error, "Unable to load Staff.");

  const [profiles, memberships, branches] = await Promise.all([
    supabase.from("organization_staff_profiles")
      .select("membership_id,job_function,specializations")
      .eq("organization_id", organizationId),
    supabase.from("organization_memberships")
      .select("id,is_active")
      .eq("organization_id", organizationId),
    supabase.from("membership_branch_assignments")
      .select("membership_id,branch_id")
      .eq("organization_id", organizationId),
  ]);
  if (profiles.error) fail(profiles.error, "Unable to load Staff profiles.");
  if (memberships.error) fail(memberships.error, "Unable to load Staff.");
  if (branches.error) fail(branches.error, "Unable to load Staff branches.");

  const membershipActive = new Map((memberships.data ?? []).map((row) => [String(row.id), Boolean(row.is_active)]));
  const branchIds = new Map<string, string[]>();
  for (const row of branches.data ?? []) {
    const membershipId = String(row.membership_id);
    branchIds.set(membershipId, [...(branchIds.get(membershipId) ?? []), String(row.branch_id)]);
  }
  return ((profiles.data ?? []) as LegacyStaffProfileRow[])
    .filter((profile) => membershipActive.get(profile.membership_id) === true)
    .map((profile) => ({
      staffId: profile.membership_id,
      // The legacy profile model has no organization-readable display name.
      // Do not broaden profile/auth visibility merely to enrich this fallback.
      fullName: "Staff member",
      jobFunction: profile.job_function,
      specializations: profile.specializations ?? [],
      isActive: true,
      branchIds: branchIds.get(profile.membership_id) ?? [],
      hasLogin: true,
    }));
}

export async function listStaffScheduleAssignments(input: {
  organizationId: string;
  branchId: string;
  startsAt: string;
  endsAt: string;
}): Promise<StaffScheduleAssignment[]> {
  const supabase = await createClient();
  const selectAppointment = "appointments!inner(id,branch_id,starts_at,status)";
  const canonical = await supabase.from("appointment_staff_assignments")
    .select(`staff_profile_id,${selectAppointment}`)
    .eq("organization_id", input.organizationId)
    .eq("appointments.branch_id", input.branchId)
    .gte("appointments.starts_at", input.startsAt)
    .lt("appointments.starts_at", input.endsAt)
    .not("appointments.status", "in", "(cancelled,no_show)");
  if (!canonical.error) return normalizeScheduleAssignments(canonical.data ?? [], "staff_profile_id");
  if (!isMissingAppointmentStaffProfileId(canonical.error)) fail(canonical.error, "Unable to load Staff appointments.");

  const legacy = await supabase.from("appointment_staff_assignments")
    .select(`staff_membership_id,${selectAppointment}`)
    .eq("organization_id", input.organizationId)
    .eq("appointments.branch_id", input.branchId)
    .gte("appointments.starts_at", input.startsAt)
    .lt("appointments.starts_at", input.endsAt)
    .not("appointments.status", "in", "(cancelled,no_show)");
  if (legacy.error) fail(legacy.error, "Unable to load Staff appointments.");
  return normalizeScheduleAssignments(legacy.data ?? [], "staff_membership_id");
}

function mapCurrentStaffProfiles(rows: Record<string, unknown>[]): StaffManagementItem[] {
  return rows.map((row) => ({
    id: String(row.staff_id), organizationId: String(row.organization_id), membershipId: row.membership_id ? String(row.membership_id) : null,
    userId: row.user_id ? String(row.user_id) : null,
    fullName: String(row.full_name), email: row.email ? String(row.email) : null, mobile: row.mobile ? String(row.mobile) : null,
    jobFunction: row.job_function ? String(row.job_function) : null, specializations: (row.specializations as string[] | null) ?? [],
    isActive: Boolean(row.is_active), branchIds: (row.branch_ids as string[] | null) ?? [], hasLogin: Boolean(row.has_login),
    systemAccessStatus: String(row.system_access_status) as StaffManagementItem["systemAccessStatus"],
    role: row.role ? String(row.role) as StaffManagementItem["role"] : null,
    accessBranchIds: (row.access_branch_ids as string[] | null) ?? [], createdAt: String(row.created_at),
  }));
}

function mapLegacyStaffProfiles(
  organizationId: string,
  staffRows: LegacyStaffRow[],
  profileRows: LegacyStaffProfileRow[],
): StaffManagementItem[] {
  const profileByMembership = new Map(profileRows.map((profile) => [profile.membership_id, profile]));
  return staffRows.map((staff) => {
    const profile = profileByMembership.get(staff.membership_id);
    const branchIds = staff.branch_ids ?? [];
    return {
      id: staff.membership_id,
      organizationId,
      membershipId: staff.membership_id,
      userId: staff.user_id,
      fullName: normalizeLegacyStaffName(staff.full_name),
      email: staff.email,
      mobile: null,
      jobFunction: profile?.job_function ?? null,
      specializations: profile?.specializations ?? [],
      isActive: staff.is_active,
      branchIds,
      hasLogin: true,
      systemAccessStatus: staff.is_active ? "active" : "disabled",
      role: staff.role,
      accessBranchIds: branchIds,
      createdAt: staff.created_at,
    };
  });
}

function normalizeScheduleAssignments(rows: Record<string, unknown>[], staffColumn: "staff_profile_id" | "staff_membership_id"): StaffScheduleAssignment[] {
  return rows.map((row) => ({
    staffId: String(row[staffColumn]),
    appointment: one(row.appointments as AppointmentRow | AppointmentRow[] | null),
  }));
}

function normalizeLegacyStaffName(value: string | undefined) {
  return !value || value === "KarKR user" || value === "ServiceCore user" ? "Staff member" : value;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function persistStaffProfile(input: z.output<typeof saveStaffProfileInputSchema>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_staff_profile", {
    p_staff_id: input.staffId, p_organization_id: input.organizationId, p_full_name: input.fullName,
    p_email: input.email ? input.email.toLowerCase() : null, p_mobile: input.mobile, p_job_function: input.jobFunction,
    p_specializations: input.specializations, p_is_active: input.isActive, p_branch_ids: input.branchIds,
  });
  if (error || !data) fail(error, "Unable to save Staff.");
  return data as string;
}

export async function persistStaffProfileInvitation(input: z.output<typeof staffProfileInvitationInputSchema>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_staff_profile_invitation", {
    p_staff_id: input.staffId, p_login_email: input.loginEmail, p_role: input.role,
    p_branch_ids: input.branchIds, p_expires_hours: input.expiresHours,
  });
  if (error || !data) fail(error, "Unable to create Staff invitation.");
  return data as string;
}

export async function persistStaffProfileAccess(input: z.output<typeof updateStaffProfileAccessInputSchema>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_staff_profile_access", {
    p_staff_id: input.staffId, p_role: input.role, p_is_active: input.isActive, p_branch_ids: input.branchIds,
  });
  if (error) fail(error, "Unable to update Staff access.");
}
