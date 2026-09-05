import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function VehiclesLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("vehicles");
  return children;
}
