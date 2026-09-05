export type StaffSystemAccessStatus = "active" | "disabled" | "pending" | "none";

export type StaffDirectoryItem = {
  id: string;
  organizationId: string;
  fullName: string;
  jobFunction: string | null;
  specializations: string[];
  isActive: boolean;
  branchIds: string[];
  hasLogin: boolean;
};

export type StaffManagementItem = StaffDirectoryItem & {
  membershipId: string | null;
  userId: string | null;
  email: string | null;
  mobile: string | null;
  systemAccessStatus: StaffSystemAccessStatus;
  role: "owner" | "manager" | "advisor" | "technician" | "cashier" | "viewer" | null;
  accessBranchIds: string[];
  createdAt: string;
};

export type StaffNotificationEligibility =
  | { eligible: true; reason: "ELIGIBLE"; recipientAddress: string }
  | { eligible: false; reason: Exclude<DeliveryEligibilityReason, "ELIGIBLE"> };
import type { DeliveryEligibilityReason } from "@/lib/notifications/eligibility";
