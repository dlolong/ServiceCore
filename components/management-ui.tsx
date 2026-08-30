"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function FormDialog({ id, title, description, closeHref, children, size = "lg" }: { id: string; title: string; description?: string; closeHref: string; children: ReactNode; size?: "md" | "lg" | "xl" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
  const widths = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return <dialog ref={dialogRef} id={id} aria-labelledby={`${id}-title`} className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] ${widths[size]} overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/50`}>
    <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
        <div><h2 id={`${id}-title`} className="text-lg font-black">{title}</h2>{description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}</div>
        <Link id={`${id}-close-button`} href={closeHref} aria-label={`Close ${title}`} title="Close" className="grid min-h-10 min-w-10 place-items-center rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"><X size={20}/></Link>
      </header>
      <div id={`${id}-content`} className="min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
