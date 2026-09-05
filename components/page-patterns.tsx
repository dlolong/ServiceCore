import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({ id, eyebrow, title, description, action }: { id: string; eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header id={id} className="flex min-w-0 flex-wrap items-end justify-between gap-3">
    <div className="min-w-0 flex-1">{eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">{eyebrow}</p> : null}<h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-admin-text sm:text-3xl">{title}</h1>{description ? <p className="mt-1 max-w-3xl text-sm text-admin-text-secondary">{description}</p> : null}</div>{action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
  </header>;
}

export function FilterBar({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="mt-4 rounded-ui-lg border border-admin-border bg-admin-surface p-3 shadow-ui-sm">{children}</div>;
}

export function EmptyState({ id, title, description, action }: { id: string; title: string; description: string; action?: ReactNode }) {
  return <section id={id} className="rounded-ui-lg border border-dashed border-admin-border-strong bg-admin-surface-muted px-5 py-8 text-center"><h2 className="font-semibold text-admin-text">{title}</h2><p className="mx-auto mt-1 max-w-lg text-sm text-admin-text-secondary">{description}</p>{action ? <div className="mt-4 flex justify-center">{action}</div> : null}</section>;
}

export function SectionHeader({ id, title, description, action }: { id: string; title: string; description?: string; action?: ReactNode }) {
  return <header id={id} className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-base font-semibold text-admin-text">{title}</h2>{description ? <p className="mt-1 text-sm text-admin-text-secondary">{description}</p> : null}</div>{action}</header>;
}

export function StatusPill({ active, activeLabel = "Active", inactiveLabel = "Inactive", id, className }: { active: boolean; activeLabel?: string; inactiveLabel?: string; id?: string; className?: string }) {
  return <span id={id} className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold leading-none", active ? "border-emerald-200 bg-status-success-tint text-status-success" : "border-admin-border bg-slate-100 text-slate-700", className)}>{active ? activeLabel : inactiveLabel}</span>;
}

export function ErrorState({ id, title = "Something went wrong", description, action }: { id: string; title?: string; description: string; action?: ReactNode }) {
  return <section id={id} role="alert" className="rounded-ui-lg border border-red-200 bg-status-danger-tint px-4 py-4 text-status-danger"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm">{description}</p>{action ? <div className="mt-3">{action}</div> : null}</section>;
}

export function LoadingSkeleton({ id, lines = 3, className }: { id: string; lines?: number; className?: string }) {
  return <div id={id} role="status" aria-label="Loading" className={cn("animate-pulse rounded-ui-lg border border-admin-border bg-admin-surface p-4 shadow-ui-sm", className)}>{Array.from({ length: lines }, (_, index) => <span aria-hidden="true" key={index} className={cn("mt-2 block h-3 rounded bg-slate-200 first:mt-0", index === lines - 1 ? "w-2/3" : "w-full")} />)}<span className="sr-only">Loading…</span></div>;
}
