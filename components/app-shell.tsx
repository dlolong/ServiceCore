"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, CarFront, ClipboardList, Gauge, Menu, Package, Settings, Users, Wrench } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { switchOrganization } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import type { OrganizationMembership } from "@/lib/auth/context";

const nav = [
  ["/dashboard", Gauge, "Dashboard"],
  ["/dashboard/customers", Users, "Customers"],
  ["/dashboard/vehicles", CarFront, "Vehicles"],
  ["/dashboard/appointments", CalendarDays, "Appointments"],
  ["/dashboard/jobs", ClipboardList, "Job Orders"],
  ["/dashboard/services", Wrench, "Services"],
  ["/dashboard/inventory", Package, "Inventory"],
  ["/dashboard/reports", BarChart3, "Reports"],
  ["/dashboard/settings", Settings, "Settings"],
] as const;

export function AppShell({ children, activeMembership, memberships, profileName }: { children: React.ReactNode; activeMembership: OrganizationMembership; memberships: OrganizationMembership[]; profileName: string }) {
  const pathname = usePathname();
  const initials = profileName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className="min-h-screen bg-zinc-100 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-zinc-200 bg-zinc-950 text-white lg:block">
        <div className="sticky top-0 p-5">
          <div className="text-2xl font-black">Kar<span className="text-amber-400">KR</span></div>
          <div className="mt-1 truncate text-xs text-zinc-400">{activeMembership.organizationName}</div>
          <div className="mt-1 truncate text-xs text-zinc-400">{activeMembership.branchName} · {activeMembership.role}</div>
          <nav className="mt-8 space-y-1">
            {nav.map(([href, Icon, label]) => {
              const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-white text-zinc-950" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}><Icon size={18}/>{label}</Link>
            })}
          </nav>
        </div>
      </aside>
      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur lg:px-8">
          <div><div className="font-black lg:hidden">Kar<span className="text-amber-500">KR</span></div><div className="hidden text-sm font-semibold text-zinc-500 lg:block">{activeMembership.organizationName} · {activeMembership.branchName}</div></div>
          <div className="flex items-center gap-3">
            {memberships.length > 1 ? <form action={switchOrganization} className="hidden items-center gap-2 sm:flex"><label className="sr-only" htmlFor="organizationId">Active organization</label><select id="organizationId" name="organizationId" defaultValue={activeMembership.organizationId} className="min-h-11 max-w-48 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>)}</select><Button type="submit" variant="secondary">Switch</Button></form> : null}
            <details className="group relative lg:hidden">
              <summary className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden" aria-label="Open navigation"><Menu size={20} /></summary>
              <nav className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                {nav.slice(5).map(([href, Icon, label]) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-zinc-100"><Icon size={18} />{label}</Link>)}
              </nav>
            </details>
            <details className="group relative">
              <summary className="grid min-h-10 min-w-10 cursor-pointer list-none place-items-center rounded-full bg-zinc-950 px-2 text-xs font-bold text-white [&::-webkit-details-marker]:hidden" aria-label="Open user menu">{initials || "KR"}</summary>
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
                <p className="truncate px-2 text-sm font-bold">{profileName}</p><p className="truncate px-2 text-xs text-zinc-500">{activeMembership.role} · {activeMembership.organizationName}</p>
                {memberships.length > 1 ? <form action={switchOrganization} className="mt-3 border-t border-zinc-100 pt-3 sm:hidden"><label className="text-xs font-semibold" htmlFor="mobileOrganizationId">Organization</label><select id="mobileOrganizationId" name="organizationId" defaultValue={activeMembership.organizationId} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>)}</select><Button className="mt-2 w-full" type="submit" variant="secondary">Switch</Button></form> : null}
                <Link href="/dashboard/settings" className="mt-3 block rounded-xl px-2 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">Profile settings</Link>
                <form action={signOut}><button type="submit" className="min-h-11 w-full rounded-xl px-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Sign out</button></form>
              </div>
            </details>
          </div>
        </header>
        <main className="p-5 lg:p-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {nav.slice(0,5).map(([href, Icon, label]) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${active ? "text-amber-700" : "text-zinc-600"}`}><Icon size={20}/><span>{label === "Appointments" ? "Booking" : label === "Job Orders" ? "Jobs" : label}</span></Link>
        })}
      </nav>
    </div>
  );
}
