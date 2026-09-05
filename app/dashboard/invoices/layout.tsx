import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function InvoicesLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("payments");
  return children;
}
