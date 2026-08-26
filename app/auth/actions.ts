"use server";

import { redirect } from "next/navigation";

import { clientEnv } from "@/lib/env/client";
import { firstIssue, resetPasswordSchema, signInSchema, signUpSchema, updatePasswordSchema } from "@/lib/auth/schemas";
import { safeRedirectPath } from "@/lib/auth/redirect";
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
  if (!parsed.success) redirect(withMessage(`/sign-in?next=${encodeURIComponent(next)}`, "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(withMessage(`/sign-in?next=${encodeURIComponent(next)}`, "error", "Email or password is incorrect."));
  redirect(next);
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({ fullName: value(formData, "fullName"), email: value(formData, "email"), password: value(formData, "password") });
  if (!parsed.success) redirect(withMessage("/sign-up", "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const callback = new URL("/auth/callback", clientEnv.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callback.toString(), data: { full_name: parsed.data.fullName } },
  });
  if (error) redirect(withMessage("/sign-up", "error", error.message));
  if (data.session) redirect("/onboarding");
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({ email: value(formData, "email") });
  if (!parsed.success) redirect(withMessage("/forgot-password", "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const callback = new URL("/auth/callback", clientEnv.NEXT_PUBLIC_APP_URL);
  callback.searchParams.set("next", "/update-password");
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback.toString() });
  if (error) redirect(withMessage("/forgot-password", "error", "Unable to send a reset email. Try again."));
  redirect(withMessage("/forgot-password", "message", "If that account exists, a password reset link has been sent."));
}

export async function updatePassword(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse({ password: value(formData, "password") });
  if (!parsed.success) redirect(withMessage("/update-password", "error", firstIssue(parsed.error)));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect(withMessage("/update-password", "error", "The reset link is invalid or expired."));
  redirect(withMessage("/sign-in", "message", "Password updated. You can now sign in."));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
