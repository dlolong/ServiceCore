import type { ReactNode } from "react";

export function PageHeader({ id, eyebrow, title, description, action }: { id: string; eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <header id={id} className="flex flex-wrap items-end justify-between gap-3">
    <div>{eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{eyebrow}</p> : null}<h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>{description ? <p className="mt-1 max-w-3xl text-sm text-zinc-600">{description}</p> : null}</div>{action}
  </header>;
}

export function FilterBar({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">{children}</div>;
}

export function EmptyState({ id, title, description, action }: { id: string; title: string; description: string; action?: ReactNode }) {
  return <div id={id} className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center"><h2 className="font-black">{title}</h2><p className="mx-auto mt-1 max-w-lg text-sm text-zinc-600">{description}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

export function StatusPill({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>{active ? activeLabel : inactiveLabel}</span>;
}
