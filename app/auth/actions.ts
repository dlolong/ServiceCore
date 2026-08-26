"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clientEnv } from "@/lib/env/client";
import { firstIssue, resetPasswordSchema, signInSchema, signUpSchema, updatePasswordSchema } from "@/lib/auth/schemas";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/context";
import { resolveOnboardingDestination } from "@/lib/auth/onboarding";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  const submitted = formData.get(key);
  return typeof submitted === "string" ? submitted : "";
}

function withMessage(path: string, kind: "error" | "message", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${kind}=${encodeURIComponent(message)}`;
}

export async function signIn(formData: FormData) {
  const next = safeRedirectPath(value(formData, "next"), "/dashboard");
  const parsed = signInSchema.safeParse({ email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) redirect(withMessage(`/login?next=${encodeURIComponent(next)}`, "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message = error.code === "email_not_confirmed" ? "Confirm your email before signing in." : "Email or password is incorrect.";
    redirect(withMessage(`/login?next=${encodeURIComponent(next)}`, "error", message));
  }

  const destination = await resolveOnboardingDestination(supabase, data.user.id);
  if (destination.organizationId) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, destination.organizationId, activeOrganizationCookieOptions());
  }
  redirect(destination.path === "/dashboard" ? next : destination.path);
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    firstName: value(formData, "firstName"),
    lastName: value(formData, "lastName"),
    email: value(formData, "email"),
    password: value(formData, "password"),
    confirmPassword: value(formData, "confirmPassword"),
  });
  if (!parsed.success) redirect(withMessage("/signup", "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const callback = new URL("/auth/callback", clientEnv.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", "/onboarding/business");
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`;
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callback.toString(),
      data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName, full_name: fullName },
    },
  });
  if (error) redirect(withMessage("/signup", "error", friendlySignUpError(error.code)));
  if (data.session) redirect("/onboarding/business");
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({ email: value(formData, "email") });
  if (!parsed.success) redirect(withMessage("/forgot-password", "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const callback = new URL("/auth/callback", clientEnv.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", "/reset-password");
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback.toString() });
  if (error) redirect(withMessage("/forgot-password", "error", "Unable to send a reset email. Try again."));
  redirect(withMessage("/forgot-password", "message", "If that account exists, a password reset link has been sent."));
}

export async function updatePassword(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({ password: value(formData, "password"), confirmPassword: value(formData, "confirmPassword") });
  if (!parsed.success) redirect(withMessage("/reset-password", "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(withMessage("/forgot-password", "error", "The reset link is invalid or expired. Request a new one."));
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect(withMessage("/reset-password", "error", "The password could not be updated. Request a new reset link."));
  await supabase.auth.signOut();
  redirect(withMessage("/login", "message", "Password updated. Sign in with your new password."));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORGANIZATION_COOKIE);
  redirect("/login");
}

function activeOrganizationCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };
}

function friendlySignUpError(code?: string) {
  if (code === "user_already_exists" || code === "email_exists") return "An account with this email already exists. Try signing in or resetting your password.";
  if (code === "weak_password") return "Choose a stronger password with at least 8 characters.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Please wait a moment before trying again.";
  return "Unable to create your account right now. Check your details and try again.";
}
