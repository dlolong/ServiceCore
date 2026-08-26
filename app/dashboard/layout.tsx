import { AppShell } from "@/components/app-shell";
import { getDashboardContext } from "@/lib/auth/context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await getDashboardContext();
  return <AppShell activeMembership={context.activeMembership} memberships={context.memberships} profileName={context.profile.fullName}>{children}</AppShell>;
}
