"use server";

import { redirect } from "next/navigation";

import {
  staffBranchSelectionSchema,
  staffProfileAccessSchema,
  staffProfileInvitationSchema,
  staffProfileSchema,
} from "@/app/dashboard/settings/staff/staff-forms";
import { getDashboardContext } from "@/lib/auth/context";
import { firstError, formValue } from "@/lib/crm";
import { isStaffRoleAvailableForIndustry } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import {
  inviteStaffProfile as inviteStaffProfileService,
  saveStaffProfile as saveStaffProfileService,
  updateStaffProfileAccess as updateStaffProfileAccessService,
} from "@/modules/core/staff";

const path = "/dashboard/settings/staff";

function go(kind: "message" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

function branchIds(data: FormData) {
  const parsed = staffBranchSelectionSchema.safeParse({
    allBranches: data.get("allBranches") === "on",
    branchIds: data.getAll("branchIds"),
  });
  if (!parsed.success) go("error", firstError(parsed.error));
  return parsed.data;
}

export async function saveStaffProfile(data: FormData) {
  const activeValue = formValue(data, "isActive");
  const parsed = staffProfileSchema.safeParse({
    staffId: formValue(data, "staffId"),
    fullName: formValue(data, "fullName"),
    email: formValue(data, "email"),
    mobile: formValue(data, "mobile"),
    jobFunction: formValue(data, "jobFunction"),
    specializations: formValue(data, "specializations"),
    isActive: activeValue === "true" ? true : activeValue === "false" ? false : null,
    branchIds: branchIds(data),
  });
  if (!parsed.success) go("error", firstError(parsed.error));

  const { activeMembership } = await getDashboardContext();
  try {
    await saveStaffProfileService({ ...parsed.data, organizationId: activeMembership.organizationId });
  } catch {
    go("error", "Unable to save the staff profile.");
  }
  go("message", parsed.data.staffId ? "Staff profile updated." : "Staff profile added.");
}

export async function createStaffProfileInvitation(data: FormData) {
  const parsed = staffProfileInvitationSchema.safeParse({
    staffId: formValue(data, "staffId"),
    loginEmail: formValue(data, "loginEmail"),
    role: formValue(data, "role"),
    branchIds: branchIds(data),
    expiresHours: formValue(data, "expiresHours"),
  });
  if (!parsed.success) go("error", firstError(parsed.error));

  const { activeMembership } = await getDashboardContext();
  if (!isStaffRoleAvailableForIndustry(parsed.data.role, activeMembership.industry)) {
    go("error", "Select an access role for the current business type.");
  }
  let token: string;
  try {
    token = await inviteStaffProfileService(parsed.data);
  } catch {
    go("error", "Unable to create the system access invitation.");
  }
  redirect(`${path}?message=${encodeURIComponent("Invitation created. Copy the secure link below.")}&invite=${encodeURIComponent(`/accept-invite?token=${token}`)}`);
}

export async function updateStaffProfileAccess(data: FormData) {
  const activeValue = formValue(data, "isActive");
  const parsed = staffProfileAccessSchema.safeParse({
    staffId: formValue(data, "staffId"),
    role: formValue(data, "role"),
    isActive: activeValue === "true" ? true : activeValue === "false" ? false : null,
    branchIds: branchIds(data),
  });
  if (!parsed.success) go("error", firstError(parsed.error));

  const { activeMembership } = await getDashboardContext();
  if (!isStaffRoleAvailableForIndustry(parsed.data.role, activeMembership.industry)) {
    go("error", "Select an access role for the current business type.");
  }
  try {
    await updateStaffProfileAccessService(parsed.data);
  } catch {
    go("error", "Unable to update system access.");
  }
  go("message", parsed.data.isActive ? "System access updated." : "System access disabled.");
}

export async function revokeInvitation(data: FormData) {
  const invitationId = formValue(data, "invitationId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invitationId)) {
    go("error", "Invalid invitation.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_staff_invitation", { p_invitation_id: invitationId });
  if (error) go("error", "Unable to revoke the invitation.");
  go("message", "Invitation revoked.");
}
