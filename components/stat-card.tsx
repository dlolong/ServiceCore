import { Card } from "@/components/ui/card";

export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <Card className="p-5"><div className="text-sm font-semibold text-zinc-500">{label}</div><div className="mt-2 text-3xl font-black tracking-tight">{value}</div>{note ? <div className="mt-2 text-xs text-zinc-500">{note}</div> : null}</Card>;
}
