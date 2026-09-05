import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function QueueLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("queue");
  return children;
}
