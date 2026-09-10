import { createHash } from "node:crypto";
import type { QueueDisplayItem } from "@/lib/queue-display";

export type SalonQueueDisplayRow = {
  id: string;
  status: string;
  starts_at: string | null;
  customers: { full_name: string } | { full_name: string }[] | null;
};

export function abbreviatedClientName(fullName: string | null | undefined) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return "Guest";
  const first = Array.from(parts[0]).slice(0, 24).join("");
  return parts.length > 1 ? `${first} ${Array.from(parts.at(-1)!)[0]}.` : first;
}

export function salonQueueDisplayItems(rows: SalonQueueDisplayRow[], timezone: string) {
  const serving: QueueDisplayItem[] = [];
  const waiting: QueueDisplayItem[] = [];
  const formatTime = new Intl.DateTimeFormat("en-PH", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  for (const row of [...rows].sort((left, right) => (left.starts_at ?? "").localeCompare(right.starts_at ?? "") || left.id.localeCompare(right.id))) {
    if (row.status !== "checked_in" && row.status !== "in_service") continue;
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const item = {
      key: createHash("sha256").update(row.id).digest("hex").slice(0, 16),
      label: abbreviatedClientName(customer?.full_name),
      detail: row.starts_at ? `Appointment ${formatTime.format(new Date(row.starts_at))}` : null,
    };
    if (row.status === "in_service") serving.push(item);
    else waiting.push(item);
  }
  return { serving, waiting };
}
