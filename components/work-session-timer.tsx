"use client";

import { useEffect, useState } from "react";

export function WorkSessionTimer({ id, startedAt, className }: { id: string; startedAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const start = new Date(startedAt).getTime();
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1_000)) : 0;
  return <time id={id} dateTime={startedAt} className={className}>{formatWorkDuration(seconds)}</time>;
}

function formatWorkDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
