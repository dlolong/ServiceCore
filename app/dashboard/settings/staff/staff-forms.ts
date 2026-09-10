import { z } from "zod";

import { normalizePhilippineMobile } from "@/lib/notifications/eligibility";
import { staffRoles } from "@/lib/rbac";

const optionalEmail = z.string().trim().max(254)
  .refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address or leave it blank.")
  .transform((value) => value ? value.toLowerCase() : null);

const optionalMobile = z.string().trim().max(40).transform((value, context) => {
  if (!value) return null;
  const normalized = normalizePhilippineMobile(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "Enter a valid Philippine mobile number or leave it blank." });
    return z.NEVER;
  }
  return normalized;
});

const optionalJobFunction = z.string().trim().max(80).transform((value, context) => {
  if (!value) return null;
  if (value.length < 2) {
    context.addIssue({ code: "custom", message: "Job function must be at least 2 characters." });
    return z.NEVER;
  }
  return value;
});

const specializationList = z.string().trim().max(1_000).transform((value, context) => {
  const values = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (values.length > 20 || values.some((item) => item.length < 2 || item.length > 80)) {
    context.addIssue({ code: "custom", message: "Enter up to 20 specialties, each 2 to 80 characters." });
    return z.NEVER;
  }
  return [...new Set(values)];
});

export const staffBranchSelectionSchema = z.object({
  allBranches: z.boolean(),
  branchIds: z.array(z.uuid()).max(100),
}).superRefine(({ allBranches, branchIds }, context) => {
  if (allBranches && branchIds.length) context.addIssue({ code: "custom", message: "Choose either all branches or specific branches." });
  if (!allBranches && !branchIds.length) context.addIssue({ code: "custom", message: "Select at least one branch, or choose all branches." });
  if (new Set(branchIds).size !== branchIds.length) context.addIssue({ code: "custom", message: "Select each branch once." });
}).transform(({ branchIds }) => branchIds);

export const staffProfileSchema = z.object({
  staffId: z.union([z.literal(""), z.uuid()]).transform((value) => value || null),
  fullName: z.string().trim().min(1, "Enter the staff member's name.").max(120),
  email: optionalEmail,
  mobile: optionalMobile,
  jobFunction: optionalJobFunction,
  specializations: specializationList,
  isActive: z.boolean(),
  branchIds: z.array(z.uuid()).max(100),
});

export const staffProfileInvitationSchema = z.object({
  staffId: z.uuid(),
  loginEmail: z.string().trim().max(254).pipe(z.email()).transform((value) => value.toLowerCase()),
  role: z.enum(staffRoles),
  branchIds: z.array(z.uuid()).max(100),
  expiresHours: z.coerce.number().int().min(1).max(168),
});

export const staffProfileAccessSchema = z.object({
  staffId: z.uuid(),
  role: z.enum(staffRoles),
  isActive: z.boolean(),
  branchIds: z.array(z.uuid()).max(100),
});

export type StaffProfileInput = z.infer<typeof staffProfileSchema>;

export const staffJobFunctionSuggestions = {
  automotive: ["Service Advisor", "Technician", "Master Technician", "Detailer", "Inspector", "Parts Coordinator"],
  salon: ["Stylist", "Senior Stylist", "Barber", "Nail Technician", "Facialist", "Massage Therapist", "Front Desk Coordinator"],
} as const;

export function staffContactLabel(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

export function staffAccessStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return "Active access";
  if (normalized === "disabled") return "Disabled access";
  if (normalized === "pending") return "Invitation pending";
  if (normalized === "none" || normalized === "no_access") return "No access";
  return normalized ? normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "No access";
}
