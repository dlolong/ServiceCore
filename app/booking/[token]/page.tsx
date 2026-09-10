import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type Status = { industry?: "automotive" | "salon"; timezone?: string; reference: string; status: string; shopName: string; branchName: string; preferredAt: string; services: string[]; declineReason: string | null };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_booking_status", { p_token: token });
  const status = data as Status | null;
  if (!status) notFound();

  return <main id="public-booking-status-page" className="grid min-h-dvh place-items-center bg-slate-50 p-5">
    <Card id="public-booking-status-card" elevation="md" className="w-full max-w-lg p-6 sm:p-7">
      <p className="text-sm font-bold text-brand-primary-strong">Booking {status.reference}</p>
      <h1 id="public-booking-status-title" className="mt-2 text-3xl font-black capitalize text-brand-ink">{status.status}</h1>
      <p className="mt-2 text-zinc-600">{status.shopName} · {status.branchName}</p>
      <dl id="public-booking-status-details" className="mt-6 space-y-3 text-sm"><div><dt className="text-zinc-500">Preferred schedule</dt><dd className="font-bold">{new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeStyle: "short", timeZone: status.timezone ?? "Asia/Manila" }).format(new Date(status.preferredAt))}</dd></div><div><dt className="text-zinc-500">{status.industry === "salon" ? "Treatments" : "Services"}</dt><dd className="font-bold">{status.services.join(", ")}</dd></div>{status.declineReason ? <div><dt className="text-zinc-500">Shop response</dt><dd>{status.declineReason}</dd></div> : null}</dl>
      <p className="mt-6 text-xs text-zinc-500">Keep this private link to check the request status. It does not expose your personal details.</p>
    </Card>
  </main>;
}
