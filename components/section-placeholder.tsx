import Link from "next/link";

import { Button } from "@/components/ui/button";
import { productBrand } from "@/modules/platform/brand";

export function SectionPlaceholder({ title, description, phase }: { title: string; description: string; phase: string }) {
  return <section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-brand-primary">{productBrand.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-admin-text">{title}</h1><p className="mt-2 max-w-2xl text-slate-600">{description}</p></div></div><div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-admin-surface-muted p-8"><div className="text-lg font-semibold text-admin-text">Starter module boundary is ready.</div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">The production workflow for this module is implemented in {phase}. Codex has a dedicated acceptance checklist so this screen does not grow as an unstructured mock.</p><Button asChild className="mt-5"><Link href="/dashboard">Back to dashboard</Link></Button></div></section>;
}
