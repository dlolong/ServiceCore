"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function BookingStatusRefresh({ terminal, checkedAt }: { terminal: boolean; checkedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);

  useEffect(() => {
    if (terminal) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh, terminal]);

  const lastUpdated = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(checkedAt));
  return <div id="public-booking-status-refresh" className="flex flex-wrap items-center justify-between gap-3">
    <p aria-live="polite" className="text-xs leading-5 text-admin-text-muted">{terminal ? "This booking has reached a final status." : "Status refreshes automatically every 15 seconds."}<span className="block">Last update: {lastUpdated}</span></p>
    <Button id="public-booking-status-refresh-button" type="button" size="sm" variant="secondary" onClick={refresh} disabled={pending}><RefreshCw aria-hidden="true" className={pending ? "animate-spin" : ""} size={15}/>{pending ? "Refreshing…" : "Refresh status"}</Button>
  </div>;
}
