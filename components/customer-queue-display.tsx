"use client";

import { Maximize, Minimize, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { QueueDisplayItem, QueueDisplaySnapshot } from "@/lib/queue-display";

type ConnectionState = "loading" | "connected" | "retrying" | "unavailable";

function localDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

export function CustomerQueueDisplay({ branchId, initialData, publicSalon }: {
  branchId: string; initialData: QueueDisplaySnapshot | null;
  publicSalon?: { slug: string; branches: Array<{ id: string; name: string }> };
}) {
  const router = useRouter();
  const endpoint = publicSalon
    ? `/api/public/queue/${encodeURIComponent(publicSalon.slug)}/${encodeURIComponent(branchId)}`
    : `/api/queue-display/${encodeURIComponent(branchId)}`;
  const [loaded, setLoaded] = useState({ branchId, data: initialData });
  const snapshot = loaded.branchId === branchId ? loaded.data : null;
  const [connection, setConnection] = useState<ConnectionState>(initialData ? "connected" : "loading");
  const [now, setNow] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const refresh = useRef<(() => void) | null>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      if (controller || disposed) return;
      controller = new AbortController();
      setRefreshing(true);
      timeout = setTimeout(() => controller?.abort(), 8_000);
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if ([400, 401, 403, 404].includes(response.status)) {
          setLoaded({ branchId, data: null });
          setConnection("unavailable");
          return;
        }
        if (!response.ok) throw new Error("Queue unavailable");
        const data = await response.json() as QueueDisplaySnapshot;
        if (disposed) return;
        setLoaded({ branchId, data });
        setConnection("connected");
      } catch {
        if (!disposed) setConnection((previous) => previous === "unavailable" ? previous : "retrying");
      } finally {
        clearTimeout(timeout);
        controller = null;
        if (!disposed) setRefreshing(false);
      }
    }

    refresh.current = () => { void load(); };
    void load();
    const poll = setInterval(() => { void load(); }, 10_000);
    return () => {
      disposed = true;
      clearInterval(poll);
      clearTimeout(timeout);
      controller?.abort();
      refresh.current = null;
    };
  }, [branchId, endpoint]);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    const tick = setInterval(updateClock, 1_000);
    updateClock();
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => {
      clearInterval(tick);
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, []);

  async function toggleFullscreen() {
    setFullscreenError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (root.current?.requestFullscreen && document.fullscreenEnabled) {
        await root.current.requestFullscreen();
      } else {
        setFullscreenError("Fullscreen is not available in this browser. You can maximize the display window.");
      }
    } catch {
      setFullscreenError("Unable to enter or exit fullscreen. Please try again or maximize the display window.");
    }
  }

  // Do not carry yesterday's queue into the next branch-local day while a
  // refresh is unavailable. The server remains authoritative for queue order.
  const currentDay = !snapshot || !now || snapshot.date === localDate(now, snapshot.timezone);
  const visible = currentDay ? snapshot : null;
  const timezone = snapshot?.timezone ?? "UTC";
  const clock = now ? new Intl.DateTimeFormat("en", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(now) : "—";
  const date = now ? new Intl.DateTimeFormat("en", { timeZone: timezone, weekday: "long", month: "long", day: "numeric" }).format(now) : "";
  const lastUpdated = visible ? new Intl.DateTimeFormat("en", { timeZone: visible.timezone, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(visible.refreshedAt)) : null;
  const status = connection === "unavailable" ? (publicSalon ? "This queue is unavailable. Please contact the salon." : "Display unavailable. Ask a team member to reopen this display.")
    : connection === "retrying" ? "Connection interrupted. Reconnecting automatically…"
    : !currentDay ? "Updating today’s queue…"
    : connection === "loading" ? "Connecting to the queue…" : "Live queue · Updates automatically";

  return <main ref={root} id="queue-display-page" className="flex h-dvh min-h-[480px] w-full flex-col gap-4 overflow-auto bg-slate-950 p-4 text-white sm:gap-6 sm:p-6 lg:p-8">
    <header id="queue-display-header" className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0"><p id="queue-display-organization" className="break-words text-sm font-semibold uppercase tracking-widest text-cyan-300 sm:text-base">{visible?.organizationName ?? "Welcome"}</p><h1 id="queue-display-branch" className="mt-1 break-words text-2xl font-bold sm:text-3xl lg:text-4xl">{visible?.branchName ?? "Customer queue"}</h1></div>
      {publicSalon && publicSalon.branches.length > 1 ? <label id="queue-display-branch-label" className="min-w-0 max-w-full text-sm text-slate-300">Branch<select id="queue-display-branch-select" value={branchId} onChange={event => router.push(`/shop/${encodeURIComponent(publicSalon.slug)}/queue?branch=${encodeURIComponent(event.target.value)}`)} className="mt-1 block min-h-11 w-full max-w-64 rounded-xl border border-slate-700 bg-slate-900 px-3 text-white">{publicSalon.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label> : null}
      <div className="shrink-0 text-right"><p id="queue-display-clock" className="text-2xl font-semibold tabular-nums sm:text-4xl">{clock}</p><p id="queue-display-date" className="mt-1 text-sm text-slate-400 sm:text-base">{date}</p></div>
    </header>

    {visible ? <div id="queue-display-queues" className="grid min-h-[520px] flex-1 grid-cols-1 gap-4 sm:min-h-[280px] sm:grid-cols-2 sm:gap-6">
      <QueuePanel key={`${branchId}-${visible.date}-serving`} id="queue-display-serving" title={visible.industry === "salon" ? "In service" : "Now calling"} items={visible.serving} emphasis/>
      <QueuePanel key={`${branchId}-${visible.date}-waiting`} id="queue-display-waiting" title="Waiting" items={visible.waiting}/>
    </div> : <section id="queue-display-unavailable" className="flex min-h-0 flex-1 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center"><div><h2 className="text-2xl font-semibold sm:text-4xl">{connection === "unavailable" ? "Queue display unavailable" : "The queue will appear here"}</h2><p className="mt-4 text-lg text-slate-400">{status}</p></div></section>}

    <footer id="queue-display-footer" className="flex shrink-0 flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
      <div role="status"><p id="queue-display-connection" className="flex items-center gap-2"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${connection === "connected" && currentDay ? "bg-emerald-400" : "bg-amber-400"}`}/>{status}</p>{connection === "retrying" && lastUpdated ? <p id="queue-display-last-updated" className="mt-1">Last updated at {lastUpdated}</p> : null}</div>
      <div className="flex flex-wrap items-center gap-2">
        {publicSalon ? <a id="queue-display-shop-link" href={`/shop/${encodeURIComponent(publicSalon.slug)}`} className="inline-flex min-h-11 items-center px-3 text-cyan-300 underline">Salon page</a> : null}
        <button id="queue-display-refresh" type="button" disabled={refreshing} onClick={() => refresh.current?.()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 px-3 text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" className={refreshing ? "animate-spin" : undefined}/>{refreshing ? "Refreshing" : "Refresh"}</button>
        <button id="queue-display-fullscreen" type="button" onClick={() => { void toggleFullscreen(); }} aria-pressed={fullscreen} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 font-semibold text-slate-950 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">{fullscreen ? <Minimize size={16} aria-hidden="true"/> : <Maximize size={16} aria-hidden="true"/>}{fullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
      </div>
      {fullscreenError ? <p id="queue-display-fullscreen-error" role="alert" className="w-full text-amber-300">{fullscreenError}</p> : null}
    </footer>
  </main>;
}

function QueuePanel({ id, title, items, emphasis = false }: { id: string; title: string; items: QueueDisplayItem[]; emphasis?: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const element = body.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setCapacity(Math.max(1, Math.floor((entry.contentRect.height + 12) / (emphasis ? 144 : 112))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [emphasis]);

  useEffect(() => {
    const timer = setInterval(() => setRotation((value) => value + 1), 8_000);
    return () => clearInterval(timer);
  }, []);

  const pages = Math.max(1, Math.ceil(items.length / capacity));
  const page = rotation % pages;
  const pageItems = items.slice(page * capacity, (page + 1) * capacity);

  return <section id={id} aria-labelledby={`${id}-title`} className={`flex min-h-0 flex-col rounded-3xl border p-4 sm:p-5 ${emphasis ? "border-cyan-400/30 bg-cyan-950/40" : "border-slate-800 bg-slate-900"}`}>
    <div className="mb-3 flex shrink-0 items-center justify-between gap-3"><h2 id={`${id}-title`} className={`text-xl font-semibold sm:text-2xl lg:text-3xl ${emphasis ? "text-cyan-300" : "text-slate-200"}`}>{title}</h2><span id={`${id}-count`} className="rounded-full bg-white/10 px-3 py-1 text-base font-semibold tabular-nums">{items.length}<span className="sr-only"> in {title.toLowerCase()}</span></span></div>
    <div ref={body} id={`${id}-items`} className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateRows: `repeat(${Math.max(1, pageItems.length)}, minmax(0, 1fr))` }}>
      {pageItems.length ? pageItems.map((item) => <article id={`${id}-item-${item.key}`} key={item.key} className={`flex min-h-0 flex-col items-center justify-center rounded-2xl px-3 py-2 text-center ${emphasis ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-white"}`}><h3 className={`max-w-full break-words font-bold leading-tight ${emphasis ? "text-3xl sm:text-4xl lg:text-5xl" : "text-2xl sm:text-3xl lg:text-4xl"}`}>{item.label}</h3>{item.detail ? <p className={`mt-1 max-w-full break-words text-sm sm:text-base ${emphasis ? "text-slate-700" : "text-slate-300"}`}>{item.detail}</p> : null}</article>) : <p id={`${id}-empty`} className="flex items-center justify-center text-center text-lg text-slate-400">{emphasis ? "No customers currently being served" : "No customers waiting"}</p>}
    </div>
    <p id={`${id}-pagination`} className="mt-3 min-h-5 shrink-0 text-center text-xs text-slate-400">{pages > 1 ? `Page ${page + 1} of ${pages} · Rotates automatically` : "\u00a0"}</p>
  </section>;
}
