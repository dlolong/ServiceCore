"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
  count?: number;
};

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveActiveTabHref(pathname: string, items: readonly TabItem[]) {
  if (items.some((item) => item.active !== undefined)) {
    return items.find((item) => item.active)?.href;
  }
  return [...items]
    .filter((item) => pathMatches(pathname, item.href))
    .sort((first, second) => second.href.length - first.href.length)[0]?.href;
}

export function Tabs({ id, items, ariaLabel = "Sections", className }: { id: string; items: readonly TabItem[]; ariaLabel?: string; className?: string }) {
  const pathname = usePathname();
  const activeHref = resolveActiveTabHref(pathname, items);
  return <nav id={id} aria-label={ariaLabel} className={cn("overflow-x-auto overscroll-x-contain border-b border-admin-border", className)}>
    <div className="flex min-w-max gap-1">
      {items.map((item) => {
        const active = item.href === activeHref;
        return <Link
        id={item.id}
        key={item.id}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-inset",
          active ? "border-brand-primary text-brand-primary-strong" : "border-transparent text-admin-text-secondary hover:border-admin-border-strong hover:text-admin-text",
        )}
      >{item.label}{typeof item.count === "number" ? <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{item.count}</span> : null}</Link>;
      })}
    </div>
  </nav>;
}
