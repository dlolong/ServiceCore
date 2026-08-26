import { redirect } from "next/navigation";

export default async function LegacyUpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  redirect(`/reset-password${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}
