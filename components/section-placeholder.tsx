import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SectionPlaceholder({ title, description, phase }: { title: string; description: string; phase: string }) {
  return <section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-amber-600">KarKR</p><h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1><p className="mt-2 max-w-2xl text-zinc-600">{description}</p></div></div><div className="mt-8 rounded-3xl border border-dashed border-zinc-300 bg-white p-8"><div className="text-lg font-black">Starter module boundary is ready.</div><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">The production workflow for this module is implemented in {phase}. Codex has a dedicated acceptance checklist so this screen does not grow as an unstructured mock.</p><Button asChild className="mt-5"><Link href="/dashboard">Back to dashboard</Link></Button></div></section>;
}
