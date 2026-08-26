import { z } from "zod";

const password = z.string().min(8, "Password must contain at least 8 characters.").max(72, "Password is too long.");

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.email("Enter a valid email address."),
  password,
});

export const resetPasswordSchema = z.object({ email: z.email("Enter a valid email address.") });
export const updatePasswordSchema = z.object({ password });

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Business name must contain at least 2 characters.").max(120),
  slug: z.string().trim().toLowerCase().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
  phone: z.string().trim().max(30, "Phone number is too long.").optional(),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().max(30, "Phone number is too long.").optional(),
});

export const organizationIdSchema = z.uuid("Invalid organization selection.");

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the submitted values.";
}
