import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function EstimatesLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("job_orders");
  return children;
}
