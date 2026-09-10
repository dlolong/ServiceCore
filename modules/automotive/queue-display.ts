import { queueLabel } from "@/lib/operations";
import type { QueueDisplayItem } from "@/lib/queue-display";

export type AutomotiveQueueDisplayRow = { source: string; queue_number: number; status: string };

export function automotiveQueueDisplayItems(rows: AutomotiveQueueDisplayRow[]) {
  const serving: QueueDisplayItem[] = [];
  const waiting: QueueDisplayItem[] = [];
  for (const row of [...rows].sort((left, right) => left.queue_number - right.queue_number)) {
    if (row.source !== "appointment" && row.source !== "walk_in") continue;
    const label = queueLabel(row.source, row.queue_number);
    const item = { key: label, label, detail: row.status === "ready" ? "Ready for service" : row.status === "called" ? "Please see our team" : null };
    if (row.status === "called" || row.status === "ready") serving.push(item);
    else if (row.status === "waiting") waiting.push(item);
  }
  return { serving, waiting };
}
