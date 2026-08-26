export function safeRedirectPath(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const allowedPrefixes = ["/dashboard", "/onboarding", "/reset-password"];
  if (!allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`))) return fallback;
  return value;
}
