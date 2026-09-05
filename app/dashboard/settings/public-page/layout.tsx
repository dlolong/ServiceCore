import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function PublicPageSettingsLayout({children}:{children:React.ReactNode}){
  await requireIndustryFeature("booking_requests");
  return children;
}
