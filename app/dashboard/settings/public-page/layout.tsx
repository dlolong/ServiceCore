import { notFound } from "next/navigation";
import { roleHasPermission } from "@/lib/rbac";
import { requireIndustryFeature } from "@/lib/auth/industry-access";

export default async function PublicPageSettingsLayout({children}:{children:React.ReactNode}){
  const { activeMembership } = await requireIndustryFeature("booking_requests");
  if (!roleHasPermission(activeMembership.role, "settings.manage")) notFound();
  return children;
}
