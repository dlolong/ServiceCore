import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/auth/context";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, { activeMembership, profile }] = await Promise.all([searchParams, getDashboardContext()]);
  const firstName = profile.fullName.split(/\s+/)[0];
  return (
    <div className="mx-auto max-w-7xl">
      {error ? <div role="alert" className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4"><div><Badge>Workspace ready</Badge><h1 className="mt-3 text-3xl font-black tracking-tight">Welcome, {firstName}.</h1><p className="mt-2 text-zinc-500">Here is the starting point for {activeMembership.organizationName}.</p></div><Button disabled title="Available in Phase 04">+ Add walk-in</Button></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Cars today" value="0" note="Jobs arrive in Phase 05"/><StatCard label="Queue" value="0" note="Bookings arrive in Phase 04"/><StatCard label="Sales today" value="₱0" note="Payments arrive in Phase 06"/><StatCard label="Outstanding" value="₱0" note="Invoices arrive in Phase 06"/></div>
      <Card className="mt-8 p-7 text-center sm:p-10"><h2 className="text-xl font-black">Your shop workspace is ready.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600">Complete the next product phases to add services, customers, vehicles, bookings, and job orders. This dashboard will populate from real tenant-scoped data as those workflows become available.</p></Card>
    </div>
  );
}
