import { Card } from "@/components/ui/card";

export function StatCard({ label, value, note, id }: { label: string; value: string; note?: string; id?: string }) {
  const semanticId = id ?? `stat-card-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  return <Card id={semanticId} className="p-4"><div className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">{label}</div><div className="mt-1.5 text-2xl font-semibold tracking-tight text-admin-text">{value}</div>{note ? <div className="mt-1.5 text-xs text-admin-text-muted">{note}</div> : null}</Card>;
}
