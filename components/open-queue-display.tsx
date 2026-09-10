"use client";

import { MonitorUp } from "lucide-react";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";

export function OpenQueueDisplay({ branchId, publicSlug, id = "queue-display-open", label = "Open queue display" }: { branchId: string; publicSlug?: string; id?: string; label?: string }) {
  const href = publicSlug ? `/shop/${encodeURIComponent(publicSlug)}/queue?branch=${encodeURIComponent(branchId)}` : `/display/queue/${encodeURIComponent(branchId)}`;

  function openDisplay(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // Opening a blank window gives us a reliable blocked-popup signal. Remove
    // its opener before navigating; the anchor remains a usable fallback.
    const popup = window.open("about:blank", "_blank", "popup,width=1440,height=900");
    if (!popup) return;
    try {
      popup.opener = null;
      const referrer = popup.document.createElement("meta");
      referrer.name = "referrer";
      referrer.content = "no-referrer";
      popup.document.head.appendChild(referrer);
      popup.location.replace(href);
      event.preventDefault();
    } catch {
      popup.close();
    }
  }

  return <Button asChild variant="secondary"><a id={id} href={href} target="_blank" rel="noopener noreferrer" onClick={openDisplay}><MonitorUp size={18} aria-hidden="true"/>{label}<span className="sr-only"> in a new window</span></a></Button>;
}
