import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function BookingRequestsLayout({ children }: { children: React.ReactNode }) {
  await requireIndustryFeature("booking_requests");
  return children;
}
