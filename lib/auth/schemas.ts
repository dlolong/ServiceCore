import { z } from "zod";

const password = z.string().min(8, "Password must contain at least 8 characters.").max(72, "Password is too long.");
const optionalText = (maximum: number, message: string) => z.string().trim().max(maximum, message).optional();
const normalizedEmail = z.string().trim().pipe(z.email("Enter a valid email address.")).transform((value) => value.toLowerCase());
const optionalEmail = z.union([z.literal(""), normalizedEmail]).optional();
const optionalUrl = z.union([z.literal(""), z.string().trim().pipe(z.url("Enter a complete URL, including https://."))]).optional();

export const businessTypes = [
  ["car_wash", "Car Wash"],
  ["auto_detailing", "Auto Detailing"],
  ["car_wash_detailing", "Car Wash & Detailing"],
  ["auto_repair", "Auto Repair"],
  ["pms_maintenance", "PMS / Maintenance"],
  ["tire_shop", "Tire Shop"],
  ["battery_shop", "Battery Shop"],
  ["auto_aircon", "Auto Aircon"],
  ["ceramic_coating", "Ceramic Coating"],
  ["tint_ppf", "Tint / PPF"],
  ["full_auto_service", "Full Auto Service Center"],
  ["other", "Other"],
] as const;

const businessTypeValues = businessTypes.map(([value]) => value) as [string, ...string[]];

export function slugifyOrganizationName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");
}

export const signInSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email: normalizedEmail,
  password,
  confirmPassword: z.string(),
}).refine(({ password, confirmPassword }) => password === confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const resetPasswordSchema = z.object({ email: normalizedEmail });
export const updatePasswordSchema = z.object({ password, confirmPassword: z.string() }).refine(
  ({ password: newPassword, confirmPassword }) => newPassword === confirmPassword,
  { message: "Passwords do not match.", path: ["confirmPassword"] },
);

export const businessOnboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must contain at least 2 characters.").max(120),
  businessType: z.enum(businessTypeValues, "Select a business type."),
  slug: z.string().trim().toLowerCase().min(2, "Enter a shop URL.").max(70).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
  legalName: optionalText(120, "Registered business name is too long."),
  phone: optionalText(30, "Phone number is too long."),
  email: optionalEmail,
  website: optionalUrl,
  facebookPage: optionalUrl,
});

export const branchOnboardingSchema = z.object({
  organizationId: z.uuid("Invalid organization."),
  branchName: z.string().trim().min(2, "Branch name must contain at least 2 characters.").max(120),
  addressLine: z.string().trim().min(2, "Enter the branch address.").max(200),
  barangay: optionalText(120, "Barangay is too long."),
  city: z.string().trim().min(2, "Enter the city or municipality.").max(120),
  province: z.string().trim().min(2, "Enter the province.").max(120),
  postalCode: optionalText(20, "Postal code is too long."),
  country: z.string().trim().min(2, "Enter the country.").max(120),
  phone: optionalText(30, "Phone number is too long."),
  email: optionalEmail,
  openingNotes: optionalText(500, "Opening notes are too long."),
});

// Kept as a compatibility export for existing imports and downstream code.
export const onboardingSchema = businessOnboardingSchema;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().max(30, "Phone number is too long.").optional(),
});

export const organizationIdSchema = z.uuid("Invalid organization selection.");

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the submitted values.";
}
