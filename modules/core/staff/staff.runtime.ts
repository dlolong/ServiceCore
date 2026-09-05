import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { z } from "zod";
import type { saveStaffProfileInputSchema, staffProfileInvitationInputSchema, updateStaffProfileAccessInputSchema } from "@/modules/core/staff/staff.service";
import { StaffProfileError } from "@/modules/core/staff/staff.service";
import type { StaffManagementItem } from "@/modules/core/staff/staff.types";

function fail(error: { message: string } | null, fallback: string): never {
  const safe = ["staff", "branch", "invitation", "access", "email", "mobile"];
  throw new StaffProfileError(error && safe.some((term) => error.message.toLowerCase().includes(term)) ? error.message : fallback);
}

export async function listStaffProfiles(organizationId: string): Promise<StaffManagementItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_staff_profiles", { p_organization_id: organizationId });
  if (error) fail(error, "Unable to load Staff.");
  return (data ?? []).map((row: Record<string, unknown>) => ({
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
