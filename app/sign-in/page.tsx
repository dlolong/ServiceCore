import { redirect } from "next/navigation";

export default async function LegacySignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(params)) {
    for (const value of Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : []) query.append(key, value);
  }
  redirect(`/login${query.size ? `?${query}` : ""}`);
}
