"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode, type SyntheticEvent } from "react";

export function FormDialog({ id, title, description, closeHref, children, size = "lg" }: { id: string; title: string; description?: string; closeHref: string; children: ReactNode; size?: "md" | "lg" | "xl" }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const widths = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    router.replace(closeHref);
  }
  return <dialog ref={dialogRef} id={id} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} onCancel={handleCancel} className={`m-auto h-dvh max-h-dvh w-full max-w-none overflow-hidden rounded-none border-0 bg-admin-surface-raised p-0 text-admin-text shadow-ui-md backdrop:bg-slate-950/45 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-ui-lg sm:border sm:border-admin-border ${widths[size]}`}>
    <div className="flex h-full max-h-dvh min-h-0 flex-col sm:max-h-[calc(100dvh-2rem)]">
      <header id={`${id}-header`} className="flex shrink-0 items-start justify-between gap-4 border-b border-admin-border bg-admin-surface px-4 py-4 sm:px-6">
        <div className="min-w-0"><h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>{description ? <p id={`${id}-description`} className="mt-1 text-sm text-admin-text-secondary">{description}</p> : null}</div>
        <Link id={`${id}-close-button`} href={closeHref} aria-label={`Close ${title}`} title={`Close ${title}`} className="grid size-11 shrink-0 place-items-center rounded-ui-md text-admin-text-secondary transition-colors hover:bg-slate-100 hover:text-admin-text focus-visible:ring-2 focus-visible:ring-brand-primary"><X aria-hidden="true" size={20}/></Link>
      </header>
      <div id={`${id}-content`} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
    </div>
  </dialog>;
}

export function DialogFooter({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return <footer id={id} className={`sticky bottom-0 z-10 mt-5 flex flex-wrap justify-end gap-2 border-t border-admin-border bg-admin-surface/95 px-1 py-3 backdrop-blur ${className ?? ""}`}>{children}</footer>;
}
