import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("job_orders");
  return children;
}
