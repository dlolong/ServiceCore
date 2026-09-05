import { z } from "zod";

import { evaluateNotificationDeliveryEligibility, normalizeNotificationEmail, normalizePhilippineMobile, type NotificationChannel } from "@/lib/notifications/eligibility";
import type { StaffNotificationEligibility } from "@/modules/core/staff/staff.types";

const nullableEmail = z.string().trim().max(254).nullable().optional()
  .transform((value) => value ? normalizeNotificationEmail(value) ?? value : null);
const nullableMobile = z.string().trim().max(40).nullable().optional()
  .transform((value) => value ? normalizePhilippineMobile(value) ?? value : null);

export const saveStaffProfileInputSchema = z.object({
  staffId: z.uuid().nullable(),
  organizationId: z.uuid(),
  fullName: z.string().trim().min(1).max(120),
  email: nullableEmail,
  mobile: nullableMobile,
  jobFunction: z.string().trim().max(80).nullable().optional().transform((value) => value || null),
  specializations: z.array(z.string().trim().min(2).max(80)).max(50).default([]),
  isActive: z.boolean(),
  branchIds: z.array(z.uuid()).max(100).default([]),
}).superRefine((input, context) => {
  if (input.email && !normalizeNotificationEmail(input.email)) context.addIssue({ code: "custom", path: ["email"], message: "Enter a valid Staff email or leave it blank." });
  if (input.mobile && !normalizePhilippineMobile(input.mobile)) context.addIssue({ code: "custom", path: ["mobile"], message: "Enter a valid Philippine Staff mobile number or leave it blank." });
  if (new Set(input.branchIds).size !== input.branchIds.length) context.addIssue({ code: "custom", path: ["branchIds"], message: "Select each Staff branch once." });
});

export const staffProfileInvitationInputSchema = z.object({
  staffId: z.uuid(),
  loginEmail: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  role: z.enum(["manager", "advisor", "technician", "cashier", "viewer"]),
  branchIds: z.array(z.uuid()).max(100),
  expiresHours: z.coerce.number().int().min(1).max(168),
});

export const updateStaffProfileAccessInputSchema = z.object({
  staffId: z.uuid(),
  role: z.enum(["manager", "advisor", "technician", "cashier", "viewer"]),
  isActive: z.boolean(),
  branchIds: z.array(z.uuid()).max(100),
});

export type SaveStaffProfileInput = z.input<typeof saveStaffProfileInputSchema>;
export type StaffProfileInvitationInput = z.input<typeof staffProfileInvitationInputSchema>;
export type UpdateStaffProfileAccessInput = z.input<typeof updateStaffProfileAccessInputSchema>;

export class StaffProfileError extends Error {
  constructor(message: string) { super(message); this.name = "StaffProfileError"; }
}

export function evaluateStaffNotificationEligibility(input: {
  channel: NotificationChannel;
  email?: string | null;
  mobile?: string | null;
  optedIn: boolean;
}): StaffNotificationEligibility {
  const rawRecipient = input.channel === "email" ? input.email ?? null : input.mobile ?? null;
  const eligibility = evaluateNotificationDeliveryEligibility({ channel: input.channel, recipientAddress: rawRecipient, optedIn: input.optedIn });
  if (!eligibility.eligible) return eligibility;
  const recipientAddress = input.channel === "email" ? normalizeNotificationEmail(rawRecipient) : normalizePhilippineMobile(rawRecipient);
  if (!recipientAddress) throw new StaffProfileError("Staff notification recipient is invalid.");
  return { eligible: true, reason: "ELIGIBLE", recipientAddress };
}

export async function saveStaffProfile(input: SaveStaffProfileInput) {
  const parsed = saveStaffProfileInputSchema.safeParse(input);
  if (!parsed.success) throw new StaffProfileError(parsed.error.issues[0]?.message ?? "Staff details are invalid.");
  const runtime = await import("@/modules/core/staff/staff.runtime");
  return runtime.persistStaffProfile(parsed.data);
}

export async function inviteStaffProfile(input: StaffProfileInvitationInput) {
  const parsed = staffProfileInvitationInputSchema.safeParse(input);
  if (!parsed.success) throw new StaffProfileError(parsed.error.issues[0]?.message ?? "Staff invitation is invalid.");
  const runtime = await import("@/modules/core/staff/staff.runtime");
  return runtime.persistStaffProfileInvitation(parsed.data);
}

export async function updateStaffProfileAccess(input: UpdateStaffProfileAccessInput) {
  const parsed = updateStaffProfileAccessInputSchema.safeParse(input);
  if (!parsed.success) throw new StaffProfileError(parsed.error.issues[0]?.message ?? "Staff access details are invalid.");
  const runtime = await import("@/modules/core/staff/staff.runtime");
  return runtime.persistStaffProfileAccess(parsed.data);
}
