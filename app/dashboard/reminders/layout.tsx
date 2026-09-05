import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("maintenance");
  return children;
}
