"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, BarChart3, Bell, CalendarCheck, CalendarDays, CarFront, ClipboardList, CreditCard, Gauge, ListOrdered, Menu, Package, Settings, Timer, Users, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { signOut } from "@/app/auth/actions";
import { switchBranch, switchOrganization } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";
import { BrandWordmark } from "@/components/brand-wordmark";
import type { OrganizationMembership } from "@/lib/auth/context";
import { resolveIndustryConfig } from "@/modules/platform/industry";
import { groupNavigationByImportance, navigationForIndustry } from "@/modules/platform/navigation";
import { resolveProductEntry } from "@/modules/platform/product-entry";

const navigationIcons: Record<string, LucideIcon> = {
  dashboard: Gauge,
  customers: Users,
  vehicles: CarFront,
  appointments: CalendarDays,
  queue: ListOrdered,
  jobs: ClipboardList,
  my_work: Timer,
  payments: CreditCard,
  bookings: CalendarCheck,
  services: Wrench,
  inventory: Package,
  reminders: Bell,
  reports: BarChart3,
  settings: Settings,
  staff: Users,
  resources: Armchair,
};

const navigationStyles = {
  groupLabel: "text-slate-400",
  sidebarActive: "bg-brand-primary text-white shadow-ui-sm",
  sidebarInactive: "text-slate-300 hover:bg-white/10 hover:text-white",
  sidebarIcon: "text-slate-400",
  lightActive: "bg-brand-tint text-brand-primary-strong",
  lightInactive: "text-slate-700 hover:bg-slate-100 hover:text-admin-text",
  lightIcon: "text-slate-500",
};

function navigationPathMatches(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

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
  const industryConfig = resolveIndustryConfig(activeMembership.industry);
  const productEntry = resolveProductEntry(activeMembership.industry);
  const nav = navigationForIndustry(industryConfig, activeMembership.role);
  const navigationGroups = groupNavigationByImportance(nav);
  const mobileKeys = industryConfig.key === "salon" ? new Set(["/dashboard", "/dashboard/appointments", "/dashboard/customers"]) : new Set(["/dashboard", "/dashboard/appointments", "/dashboard/queue", "/dashboard/customers"]);
  const mobileNav = nav.filter(({ href }) => mobileKeys.has(href));
  const overflowNavigationGroups = groupNavigationByImportance(nav.filter(({ href }) => !mobileKeys.has(href)));
  const activeHref = [...nav]
    .filter(({ href }) => navigationPathMatches(pathname, href))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href;
  const initials = profileName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div id="dashboard-app-shell" className="flex h-dvh min-h-0 overflow-hidden bg-admin-canvas lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside id="dashboard-sidebar" className="hidden overflow-y-auto border-r border-slate-800 bg-brand-ink text-white lg:block">
        <div className="p-5">
          <Link id="negosu-dashboard-home-link" href="/dashboard" className="inline-block" aria-label={`${productEntry.productName} dashboard`}><BrandWordmark inverse className="w-28" /></Link>
          <div className="mt-3 truncate text-sm font-bold text-white">{activeMembership.organizationName}</div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-300">{productEntry.productName}</div>
          <div className="mt-1 truncate text-xs text-slate-400">{activeMembership.branchName} · {activeMembership.role}</div>
          <nav id="dashboard-desktop-navigation" className="mt-6 space-y-5" aria-label="Main navigation">
            {navigationGroups.map((group) => {
              return <section id={`dashboard-navigation-group-${group.importance}`} key={group.importance}>
                <h2 className={`px-3 text-[10px] font-semibold uppercase tracking-[0.16em] ${navigationStyles.groupLabel}`}>{group.label}</h2>
                <div className="mt-1.5 space-y-1">
                  {group.items.map((item) => {
                    const Icon = navigationIcons[item.key] ?? Settings;
                    const active = item.href === activeHref;
                    return <Link
                      id={`desktop-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2 text-sm font-medium transition-colors ${active ? navigationStyles.sidebarActive : navigationStyles.sidebarInactive}`}
                    >
                      <Icon aria-hidden="true" className={active ? "text-current" : navigationStyles.sidebarIcon} size={17}/>{item.label}
                    </Link>;
                  })}
                </div>
              </section>;
            })}
          </nav>
        </div>
      </aside>
      <div id="dashboard-content-frame" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header id="dashboard-header" className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-admin-border bg-admin-surface px-3 py-2.5 shadow-ui-sm sm:px-4 lg:px-6">
          <div className="min-w-0 flex-1"><Link id="negosu-dashboard-mobile-home-link" href="/dashboard" className="hidden min-[360px]:inline-block lg:hidden" aria-label={`${productEntry.productName} dashboard`}><BrandWordmark className="w-20 sm:w-24" /></Link><div className="hidden truncate text-sm font-medium text-admin-text-secondary lg:block">{activeMembership.organizationName} · {productEntry.productName}</div></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {activeMembership.branches.length > 1 ? <form id="dashboard-branch-switcher" action={switchBranch} className="flex items-center gap-2"><label className="sr-only" htmlFor="branchId">Current branch</label><select id="branchId" name="branchId" defaultValue={activeMembership.branchId} className="min-h-11 max-w-28 rounded-ui-md border border-admin-border-strong bg-white px-2 text-sm font-medium text-admin-text shadow-ui-sm sm:max-w-40 sm:px-3">{activeMembership.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><SubmitButton pendingText="Switching…" variant="secondary" className="hidden sm:inline-flex">Switch</SubmitButton></form> : <span className="hidden text-sm font-medium text-admin-text-secondary sm:inline">{activeMembership.branchName}</span>}
            {memberships.length > 1 ? <form id="negosu-business-switcher" action={switchOrganization} className="hidden items-center gap-2 xl:flex"><label className="sr-only" htmlFor="negosu-business-switcher-select">Active business</label><select id="negosu-business-switcher-select" name="organizationId" defaultValue={activeMembership.organizationId} className="min-h-11 max-w-56 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-admin-text shadow-sm">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName} — {resolveProductEntry(membership.industry).productName}</option>)}</select><SubmitButton id="negosu-business-switcher-submit-button" pendingText="Switching…" variant="secondary">Switch</SubmitButton></form> : null}
            <DismissibleDetails className="group relative lg:hidden">
              <summary id="dashboard-overflow-navigation-button" className="grid size-11 cursor-pointer list-none place-items-center rounded-ui-md border border-admin-border-strong bg-white text-admin-text shadow-ui-sm hover:bg-slate-100 [&::-webkit-details-marker]:hidden" aria-label="Open navigation" aria-haspopup="menu"><Menu aria-hidden="true" size={20} /></summary>
              <nav id="dashboard-overflow-navigation" className="absolute right-0 mt-2 w-64 space-y-3 rounded-ui-lg border border-admin-border bg-white p-3 shadow-ui-md" aria-label="More navigation">
                {overflowNavigationGroups.map((group) => {
                  return <section id={`dashboard-overflow-navigation-group-${group.importance}`} key={group.importance}>
                    <h2 className={`px-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${navigationStyles.lightIcon}`}>{group.label}</h2>
                    <div className="mt-1">{group.items.map((item) => {
                      const Icon = navigationIcons[item.key] ?? Settings;
                      const active = item.href === activeHref;
                      return <Link
                        id={`overflow-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2 text-sm font-medium ${active ? navigationStyles.lightActive : navigationStyles.lightInactive}`}
                      ><Icon aria-hidden="true" className={active ? "text-current" : navigationStyles.lightIcon} size={18}/>{item.label}</Link>;
                    })}</div>
                  </section>;
                })}
              </nav>
            </DismissibleDetails>
            <DismissibleDetails className="group relative">
              <summary id="dashboard-user-menu-button" className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-brand-primary px-2 text-xs font-semibold text-white shadow-ui-sm [&::-webkit-details-marker]:hidden" aria-label="Open user menu" aria-haspopup="menu">{initials || "NS"}</summary>
              <div id="dashboard-user-menu" className="absolute right-0 mt-2 w-64 rounded-ui-lg border border-admin-border bg-white p-3 shadow-ui-md">
                <p className="truncate px-2 text-sm font-bold text-admin-text">{profileName}</p><p className="truncate px-2 text-xs text-slate-500">{activeMembership.role} · {activeMembership.organizationName}</p>
                {memberships.length > 1 ? <form id="negosu-mobile-business-switcher" action={switchOrganization} className="mt-3 border-t border-slate-100 pt-3 xl:hidden"><label className="text-xs font-semibold" htmlFor="negosu-mobile-business-switcher-select">Business</label><select id="negosu-mobile-business-switcher-select" name="organizationId" defaultValue={activeMembership.organizationId} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName} — {resolveProductEntry(membership.industry).productName}</option>)}</select><SubmitButton id="negosu-mobile-business-switcher-submit-button" className="mt-2 w-full" pendingText="Switching…" variant="secondary">Switch business</SubmitButton></form> : null}
                <Link id="negosu-user-menu-continue-setup-link" href="/onboarding/setup" className="mt-3 block rounded-xl px-2 py-2 text-sm font-semibold text-admin-text hover:bg-slate-100">Continue setup</Link>
                <Link id="user-menu-profile-settings-link" href="/dashboard/settings" className="mt-3 block rounded-xl px-2 py-2 text-sm font-semibold text-admin-text hover:bg-slate-100">Profile settings</Link>
                <form id="user-menu-sign-out-form" action={signOut}><SubmitButton id="user-menu-sign-out-button" className="w-full justify-start px-2" pendingText="Signing out…" variant="destructive">Sign out</SubmitButton></form>
              </div>
            </DismissibleDetails>
          </div>
        </header>
        <main id="dashboard-main-content" className="admin-main-surface min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <nav id="dashboard-mobile-navigation" className={`fixed inset-x-0 bottom-0 z-30 grid ${industryConfig.key === "salon" ? "grid-cols-4" : "grid-cols-5"} border-t border-admin-border bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_18px_rgba(15,23,42,0.05)] backdrop-blur lg:hidden`}>
        {mobileNav.map((item) => {
          const Icon = navigationIcons[item.key] ?? Settings;
          const active = item.href === activeHref;
          return <Link
            id={`mobile-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`mx-0.5 flex min-h-14 flex-col items-center justify-center gap-1 rounded-ui-sm px-1 py-1 text-[10px] font-medium ${active ? navigationStyles.lightActive : navigationStyles.lightInactive}`}
          ><Icon aria-hidden="true" size={20}/><span>{item.mobileLabel ?? item.label}</span></Link>;
        })}<Link id="mobile-nav-settings" href="/dashboard/settings" aria-current={activeHref === "/dashboard/settings" ? "page" : undefined} className={`mx-0.5 flex min-h-14 flex-col items-center justify-center gap-1 rounded-ui-sm px-1 py-1 text-[10px] font-medium ${activeHref === "/dashboard/settings" ? navigationStyles.lightActive : navigationStyles.lightInactive}`}><Settings aria-hidden="true" size={20}/><span>Settings</span></Link>
      </nav>
    </div>
  );
}
