import type { ReactNode } from "react";
import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function ReportsLayout({children}:{children:ReactNode}) {
  await requireIndustryFeature("job_orders");
  return children;
}
