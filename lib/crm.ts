import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  return `+${digits}`;
}

export function displayPhone(value: string | null) {
  const normalized = value ? normalizePhone(value) : null;
  if (normalized?.match(/^\+639\d{9}$/)) return `0${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  return value || "No phone";
}

export function normalizePlate(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase() || null;
}

export function vehicleLabel(vehicle: { model_year?: number | null; make: string; model: string; plate_number?: string | null }) {
  const identity = [vehicle.model_year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return `${identity} • ${vehicle.plate_number?.trim() || "No Plate"}`;
}

export const branchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(2).max(200),
  barangay: optionalText(120), city: z.string().trim().min(2).max(120), province: z.string().trim().min(2).max(120),
  postalCode: optionalText(20), country: z.string().trim().min(2).max(120).default("Philippines"),
  phone: optionalText(40), email: z.union([z.literal(""), z.email()]).transform((value) => value || null), openingNotes: optionalText(500),
});

export const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(160), phone: optionalText(40),
  email: z.union([z.literal(""), z.email()]).transform((value) => value || null),
  addressLine: optionalText(200), city: optionalText(120), province: optionalText(120), notes: optionalText(2000),
  acceptDuplicate: z.boolean().default(false),
});

const currentYear = new Date().getFullYear();
export const vehicleSchema = z.object({
  customerId: z.uuid(), make: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(80),
  plateNumber: optionalText(30), modelYear: z.union([z.literal(""), z.coerce.number().int().min(1900).max(currentYear + 1)]).transform((value) => value === "" ? null : value),
  variant: optionalText(80), color: optionalText(60), vehicleType: optionalText(40), fuelType: optionalText(40), transmission: optionalText(40),
  odometerKm: z.union([z.literal(""), z.coerce.number().int().min(0).max(10_000_000)]).transform((value) => value === "" ? null : value),
  vin: optionalText(80), engineNumber: optionalText(80), notes: optionalText(2000), acceptDuplicate: z.boolean().default(false),
});

export function formValue(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" ? value : ""; }
export function firstError(error: z.ZodError) { return error.issues[0]?.message ?? "Check the submitted details."; }
