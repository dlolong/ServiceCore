"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, CalendarCheck, CalendarDays, CarFront, ClipboardList, CreditCard, Gauge, ListOrdered, Menu, Package, Settings, Users, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { signOut } from "@/app/auth/actions";
import { switchBranch, switchOrganization } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";
import { BrandLogo } from "@/components/brand-logo";
import type { OrganizationMembership } from "@/lib/auth/context";
import { karkrNavigation } from "@/modules/platform/navigation";

const navigationIcons: Record<(typeof karkrNavigation)[number]["key"], LucideIcon> = {
  dashboard: Gauge,
  customers: Users,
  vehicles: CarFront,
  appointments: CalendarDays,
  queue: ListOrdered,
  jobs: ClipboardList,
  payments: CreditCard,
  bookings: CalendarCheck,
  services: Wrench,
  inventory: Package,
  reminders: Bell,
  reports: BarChart3,
  settings: Settings,
};

const nav = karkrNavigation.map((item) => [item.href, navigationIcons[item.key], item.label] as const);

const mobileNav = [nav[0], nav[3], nav[4], nav[1]] as const;
const desktopNavGroups = [
  [nav[0], nav[3], nav[4], nav[5], nav[6], nav[7]],
  [nav[1], nav[2], nav[8]],
  [nav[9], nav[10], nav[11], nav[12]],
] as const;

function DismissibleDetails({ children, className }: { children: ReactNode; className?: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeWhenOutside(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector<HTMLElement>("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <details ref={detailsRef} className={className}>{children}</details>;
}

export function AppShell({ children, activeMembership, memberships, profileName }: { children: React.ReactNode; activeMembership: OrganizationMembership; memberships: OrganizationMembership[]; profileName: string }) {
  const pathname = usePathname();
  const initials = profileName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div id="dashboard-app-shell" className="flex h-dvh min-h-0 overflow-hidden bg-zinc-100 lg:grid lg:grid-cols-[224px_1fr]">
      <aside id="dashboard-sidebar" className="hidden overflow-y-auto border-r border-zinc-200 bg-zinc-950 text-white lg:block">
        <div className="p-5">
          <Link href="/dashboard" className="inline-block" aria-label="KarKR dashboard"><BrandLogo tone="white" className="w-32" priority /></Link>
          <div className="mt-1 truncate text-xs text-zinc-400">{activeMembership.organizationName}</div>
          <div className="mt-1 truncate text-xs text-zinc-400">{activeMembership.branchName} · {activeMembership.role}</div>
          <nav id="dashboard-desktop-navigation" className="mt-6" aria-label="Main navigation">
            {desktopNavGroups.map((group, groupIndex) => (
              <div key={group[0][0]} className={`${groupIndex ? "mt-4 border-t border-white/10 pt-4" : ""} space-y-1`}>
                {group.map(([href, Icon, label]) => {
                  const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
                  return <Link id={`desktop-nav-${label.toLowerCase().replaceAll(" ", "-")}`} key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${active ? "bg-white text-zinc-950" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}><Icon size={17}/>{label}</Link>;
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>
      <div id="dashboard-content-frame" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header id="dashboard-header" className="z-20 flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-6">
          <div><Link href="/dashboard" className="inline-block lg:hidden" aria-label="KarKR dashboard"><BrandLogo long={false} className="w-9" priority /></Link><div className="hidden text-sm font-semibold text-zinc-500 lg:block">{activeMembership.organizationName}</div></div>
          <div className="flex items-center gap-3">
            {activeMembership.branches.length > 1 ? <form action={switchBranch} className="flex items-center gap-2"><label className="sr-only" htmlFor="branchId">Current branch</label><select id="branchId" name="branchId" defaultValue={activeMembership.branchId} className="min-h-11 max-w-40 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950">{activeMembership.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><SubmitButton pendingText="Switching…" variant="secondary" className="hidden sm:inline-flex">Switch</SubmitButton></form> : <span className="hidden text-sm font-semibold text-zinc-600 sm:inline">{activeMembership.branchName}</span>}
            {memberships.length > 1 ? <form action={switchOrganization} className="hidden items-center gap-2 sm:flex"><label className="sr-only" htmlFor="organizationId">Active organization</label><select id="organizationId" name="organizationId" defaultValue={activeMembership.organizationId} className="min-h-11 max-w-48 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>)}</select><SubmitButton pendingText="Switching…" variant="secondary">Switch</SubmitButton></form> : null}
            <DismissibleDetails className="group relative lg:hidden">
              <summary className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-950 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden" aria-label="Open navigation"><Menu size={20} /></summary>
              <nav id="dashboard-overflow-navigation" className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                {nav.filter(([href]) => !mobileNav.some(([mobileHref]) => mobileHref === href)).map(([href, Icon, label]) => <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-zinc-100"><Icon size={18} />{label}</Link>)}
              </nav>
            </DismissibleDetails>
            <DismissibleDetails className="group relative">
              <summary className="grid min-h-10 min-w-10 cursor-pointer list-none place-items-center rounded-full bg-zinc-950 px-2 text-xs font-bold text-white [&::-webkit-details-marker]:hidden" aria-label="Open user menu">{initials || "KR"}</summary>
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
                <p className="truncate px-2 text-sm font-bold">{profileName}</p><p className="truncate px-2 text-xs text-zinc-500">{activeMembership.role} · {activeMembership.organizationName}</p>
                {memberships.length > 1 ? <form action={switchOrganization} className="mt-3 border-t border-zinc-100 pt-3 sm:hidden"><label className="text-xs font-semibold" htmlFor="mobileOrganizationId">Organization</label><select id="mobileOrganizationId" name="organizationId" defaultValue={activeMembership.organizationId} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>)}</select><SubmitButton className="mt-2 w-full" pendingText="Switching…" variant="secondary">Switch</SubmitButton></form> : null}
                <Link href="/dashboard/settings" className="mt-3 block rounded-xl px-2 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100">Profile settings</Link>
                <form action={signOut}><SubmitButton className="w-full justify-start px-2" pendingText="Signing out…" variant="destructive">Sign out</SubmitButton></form>
              </div>
            </DismissibleDetails>
          </div>
        </header>
        <main id="dashboard-main-content" className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 pb-24 sm:p-5 sm:pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <nav id="dashboard-mobile-navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-white px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {mobileNav.map(([href, Icon, label]) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link id={`mobile-nav-${label.toLowerCase().replaceAll(" ", "-")}`} key={href} href={href} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${active ? "text-amber-700" : "text-zinc-600"}`}><Icon size={20}/><span>{label === "Appointments" ? "Booking" : label}</span></Link>
        })}<Link id="mobile-nav-more" href="/dashboard/settings" className="flex flex-col items-center gap-1 py-1 text-[10px] font-semibold text-zinc-600"><Menu size={20}/><span>More</span></Link>
      </nav>
    </div>
  );
}
