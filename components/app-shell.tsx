"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, BarChart3, Bell, Building2, CalendarCheck, CalendarDays, CarFront, ChevronDown, ClipboardList, CreditCard, Gauge, ListOrdered, MoreHorizontal, Package, Settings, Timer, Users, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { signOut } from "@/app/auth/actions";
import { switchBranch, switchOrganization } from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";
import { BrandWordmark } from "@/components/brand-wordmark";
import type { OrganizationMembership } from "@/lib/auth/context";
import { resolveIndustryConfig } from "@/modules/platform/industry";
import { groupNavigation, navigationForIndustry, type NavigationGroup } from "@/modules/platform/navigation";
import { resolveProductEntry } from "@/modules/platform/product-entry";
import type { DashboardThemeId } from "@/modules/platform/dashboard-theme";

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
  branches: Building2,
};

const navigationStyles = {
  groupLabel: "text-slate-400",
  sidebarActive: "bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-primary",
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
  const pathname = usePathname();

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

  useEffect(() => {
    if (detailsRef.current?.open) detailsRef.current.open = false;
  }, [pathname]);

  return <details ref={detailsRef} className={className}>{children}</details>;
}

function SidebarNavigationGroup({ group, activeHref }: { group: NavigationGroup; activeHref?: string }) {
  const containsActiveItem = group.items.some((item) => item.href === activeHref);
  const [expanded, setExpanded] = useState(group.key !== "more" || containsActiveItem);

  return <details
    id={`negosu-sidebar-${group.key}`}
    className="group/navigation"
    open={expanded}
    onToggle={(event) => setExpanded(event.currentTarget.open)}
  >
    <summary className={`flex min-h-9 cursor-pointer list-none items-center justify-between rounded-ui-sm px-2 text-xs font-medium ${navigationStyles.groupLabel} transition-colors hover:bg-white/5 hover:text-slate-200 [&::-webkit-details-marker]:hidden`}>
      <span>{group.label}</span>
      <ChevronDown aria-hidden="true" className="transition-transform group-open/navigation:rotate-180" size={14}/>
    </summary>
    <div className="mt-0.5 space-y-0.5">
      {group.items.map((item) => {
        const Icon = navigationIcons[item.key] ?? Settings;
        const active = item.href === activeHref;
        return <Link
          id={`desktop-nav-${item.key.replaceAll("_", "-")}`}
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`relative flex min-h-9 items-center gap-2.5 rounded-ui-sm px-2.5 py-1.5 text-sm transition-colors ${active ? `${navigationStyles.sidebarActive} font-medium` : `${navigationStyles.sidebarInactive} font-normal`}`}
        >
          <Icon aria-hidden="true" className={active ? "text-current" : navigationStyles.sidebarIcon} size={16}/>{item.label}
        </Link>;
      })}
    </div>
  </details>;
}

function MobileMoreMenu({ groups, activeHref }: { groups: NavigationGroup[]; activeHref?: string }) {
  const containsActiveItem = groups.some((group) => group.items.some((item) => item.href === activeHref));

  return <DismissibleDetails className="group relative">
    <summary
      id="mobile-nav-more"
      aria-label="Open more navigation"
      aria-haspopup="menu"
      className={`mx-0.5 flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-ui-sm px-1 py-1 text-[10px] font-normal [&::-webkit-details-marker]:hidden ${containsActiveItem ? navigationStyles.lightActive : navigationStyles.lightInactive}`}
    >
      <MoreHorizontal aria-hidden="true" size={20}/><span>More</span>
    </summary>
    <nav
      id="mobile-more-menu"
      aria-label="More navigation"
      className="absolute bottom-full right-0 mb-2 max-h-[calc(100dvh-6.5rem)] w-[min(18rem,calc(100vw-1.5rem))] touch-pan-y overflow-y-auto overscroll-y-contain rounded-ui-lg border border-admin-border bg-admin-surface p-3 shadow-ui-md"
    >
      <div className="space-y-3">
        {groups.map((group) => <section id={`mobile-more-group-${group.key}`} key={group.key}>
          <h2 className="px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-admin-text-muted">{group.label}</h2>
          <div className="mt-1 space-y-0.5">{group.items.map((item) => {
            const Icon = navigationIcons[item.key] ?? Settings;
            const active = item.href === activeHref;
            return <Link
              id={`mobile-more-nav-${item.key.replaceAll("_", "-")}`}
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-ui-md px-3 py-2 text-sm ${active ? `${navigationStyles.lightActive} font-medium` : `${navigationStyles.lightInactive} font-normal`}`}
            ><Icon aria-hidden="true" className={active ? "text-current" : navigationStyles.lightIcon} size={18}/>{item.label}</Link>;
          })}</div>
        </section>)}
      </div>
    </nav>
  </DismissibleDetails>;
}

export function AppShell({ children, activeMembership, memberships, profileName, dashboardTheme }: { children: React.ReactNode; activeMembership: OrganizationMembership; memberships: OrganizationMembership[]; profileName: string; dashboardTheme: DashboardThemeId }) {
  const pathname = usePathname();
  const industryConfig = resolveIndustryConfig(activeMembership.industry);
  const productEntry = resolveProductEntry(activeMembership.industry);
  const nav = navigationForIndustry(industryConfig, activeMembership.role);
  const navigationGroups = groupNavigation(nav);
  const dashboardNavigation = navigationGroups.find((group) => group.key === "dashboard")?.items[0];
  const sidebarGroups = navigationGroups.filter((group) => group.key !== "dashboard");
  const mobileKeys = new Set(["/dashboard", "/dashboard/appointments", "/dashboard/customers"]);
  const mobileNav = nav.filter(({ href }) => mobileKeys.has(href));
  const overflowNavigationGroups = groupNavigation(nav.filter(({ href }) => !mobileKeys.has(href)));
  const activeHref = [...nav]
    .filter(({ href }) => navigationPathMatches(pathname, href))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href;
  const initials = profileName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const mobileColumnClasses = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"] as const;
  const mobileColumnClass = mobileColumnClasses[Math.min(mobileNav.length, 3)];
  return (
    <div id="dashboard-app-shell" data-dashboard-theme={dashboardTheme} className="flex h-dvh min-h-0 overflow-hidden bg-admin-canvas lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside id="negosu-sidebar" className="hidden overflow-y-auto overscroll-y-contain border-r border-white/10 bg-brand-ink text-white lg:block">
        <div className="px-3 py-4">
          <Link id="negosu-dashboard-home-link" href="/dashboard" className="inline-block" aria-label={`${productEntry.productName} dashboard`}><BrandWordmark inverse className="w-28" /></Link>
          <div className="mt-3 truncate text-sm font-medium text-white">{activeMembership.organizationName}</div>
          <div className="mt-0.5 truncate text-xs font-normal text-slate-300">{productEntry.productName}</div>
          <div className="mt-0.5 truncate text-xs font-normal text-slate-400">{activeMembership.branchName} · {activeMembership.role}</div>
          <nav id="dashboard-desktop-navigation" className="mt-4 space-y-1" aria-label="Main navigation">
            {dashboardNavigation ? (() => {
              const DashboardIcon = navigationIcons.dashboard;
              const active = dashboardNavigation.href === activeHref;
              return <Link
                id="negosu-sidebar-dashboard"
                href={dashboardNavigation.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-9 items-center gap-2.5 rounded-ui-sm px-2.5 py-1.5 text-sm transition-colors ${active ? `${navigationStyles.sidebarActive} font-medium` : `${navigationStyles.sidebarInactive} font-normal`}`}
              ><DashboardIcon aria-hidden="true" className={active ? "text-current" : navigationStyles.sidebarIcon} size={16}/>{dashboardNavigation.label}</Link>;
            })() : null}
            <div className="space-y-1 pt-1">
              {sidebarGroups.map((group) => <SidebarNavigationGroup key={`${group.key}-${group.items.some((item) => item.href === activeHref)}`} group={group} activeHref={activeHref}/>) }
            </div>
          </nav>
        </div>
      </aside>
      <div id="dashboard-content-frame" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header id="dashboard-header" className="z-20 flex shrink-0 items-center justify-between gap-2 border-b border-admin-border bg-admin-surface px-3 py-2.5 shadow-ui-sm sm:px-4 lg:px-6">
          <div className="min-w-0 flex-1"><Link id="negosu-dashboard-mobile-home-link" href="/dashboard" className="hidden min-[360px]:inline-block lg:hidden" aria-label={`${productEntry.productName} dashboard`}><BrandWordmark className="w-20 sm:w-24" /></Link><div className="hidden truncate text-sm font-medium text-admin-text-secondary lg:block">{activeMembership.organizationName} · {productEntry.productName}</div></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {activeMembership.branches.length > 1 ? <form id="dashboard-branch-switcher" action={switchBranch} className="flex items-center gap-2"><label className="sr-only" htmlFor="branchId">Current branch</label><select id="branchId" name="branchId" defaultValue={activeMembership.branchId} className="min-h-11 max-w-28 rounded-ui-md border border-admin-border-strong bg-white px-2 text-sm font-medium text-admin-text shadow-ui-sm sm:max-w-40 sm:px-3">{activeMembership.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><SubmitButton pendingText="Switching…" variant="secondary" className="hidden sm:inline-flex">Switch</SubmitButton></form> : <span className="hidden text-sm font-medium text-admin-text-secondary sm:inline">{activeMembership.branchName}</span>}
            {memberships.length > 1 ? <form id="negosu-business-switcher" action={switchOrganization} className="hidden items-center gap-2 xl:flex"><label className="sr-only" htmlFor="negosu-business-switcher-select">Active business</label><select id="negosu-business-switcher-select" name="organizationId" defaultValue={activeMembership.organizationId} className="min-h-11 max-w-56 rounded-ui-md border border-admin-border-strong bg-admin-surface px-3 text-sm font-medium text-admin-text shadow-ui-sm">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName} — {resolveProductEntry(membership.industry).productName}</option>)}</select><SubmitButton id="negosu-business-switcher-submit-button" pendingText="Switching…" variant="secondary">Switch</SubmitButton></form> : null}
            <DismissibleDetails className="group relative">
              <summary id="dashboard-user-menu-button" className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-brand-primary px-2 text-xs font-medium text-white shadow-ui-sm [&::-webkit-details-marker]:hidden" aria-label="Open user menu" aria-haspopup="menu">{initials || "NS"}</summary>
              <div id="dashboard-user-menu" className="absolute right-0 mt-2 w-64 rounded-ui-lg border border-admin-border bg-white p-3 shadow-ui-md">
                <p className="truncate px-2 text-sm font-medium text-admin-text">{profileName}</p><p className="truncate px-2 text-xs font-normal text-admin-text-muted">{activeMembership.role} · {activeMembership.organizationName}</p>
                {memberships.length > 1 ? <form id="negosu-mobile-business-switcher" action={switchOrganization} className="mt-3 border-t border-admin-border pt-3 xl:hidden"><label className="text-xs font-medium" htmlFor="negosu-mobile-business-switcher-select">Business</label><select id="negosu-mobile-business-switcher-select" name="organizationId" defaultValue={activeMembership.organizationId} className="mt-1 min-h-11 w-full rounded-ui-md border border-admin-border-strong bg-admin-surface px-3 text-sm">{memberships.map((membership) => <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName} — {resolveProductEntry(membership.industry).productName}</option>)}</select><SubmitButton id="negosu-mobile-business-switcher-submit-button" className="mt-2 w-full" pendingText="Switching…" variant="secondary">Switch business</SubmitButton></form> : null}
                <Link id="negosu-user-menu-continue-setup-link" href="/onboarding/setup" className="mt-3 block rounded-ui-md px-2 py-2 text-sm font-medium text-admin-text hover:bg-admin-surface-muted">Continue setup</Link>
                <Link id="user-menu-profile-settings-link" href="/dashboard/settings" className="mt-1 block rounded-ui-md px-2 py-2 text-sm font-medium text-admin-text hover:bg-admin-surface-muted">Profile settings</Link>
                <form id="user-menu-sign-out-form" action={signOut}><SubmitButton id="user-menu-sign-out-button" className="w-full justify-start px-2" pendingText="Signing out…" variant="destructive">Sign out</SubmitButton></form>
              </div>
            </DismissibleDetails>
          </div>
        </header>
        <main id="dashboard-main-content" className="admin-main-surface min-h-0 min-w-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <nav id="dashboard-mobile-navigation" className={`fixed inset-x-0 bottom-0 z-30 grid ${mobileColumnClass} border-t border-admin-border bg-admin-surface/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-ui-md backdrop-blur lg:hidden`}>
        {mobileNav.map((item) => {
          const Icon = navigationIcons[item.key] ?? Settings;
          const active = item.href === activeHref;
          return <Link
            id={`mobile-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`mx-0.5 flex min-h-14 flex-col items-center justify-center gap-1 rounded-ui-sm px-1 py-1 text-[10px] ${active ? `${navigationStyles.lightActive} font-medium` : `${navigationStyles.lightInactive} font-normal`}`}
          ><Icon aria-hidden="true" size={20}/><span>{item.mobileLabel ?? item.label}</span></Link>;
        })}<MobileMoreMenu groups={overflowNavigationGroups} activeHref={activeHref}/>
      </nav>
    </div>
  );
}
