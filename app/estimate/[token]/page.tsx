import type { Metadata } from "next";
import Link from "next/link";

import { decideEstimateAction } from "@/app/estimate/[token]/actions";
import { FormDialog } from "@/components/management-ui";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/operations";
import { estimateApprovalTokenSchema, type PublicEstimateApproval } from "@/modules/automotive/work-execution/estimate-approval";
import { getPublicEstimateApproval } from "@/modules/automotive/work-execution/estimate-approval.runtime";
import { verticalBrands } from "@/modules/platform/brand";

export const dynamic="force-dynamic";
export const revalidate=0;
export const metadata:Metadata={title:`Estimate review · ${verticalBrands.automotive.displayName}`,robots:{index:false,follow:false,nocache:true}};

type Query={confirm?:"approve"|"decline";error?:string};

const stateCopy:Record<"invalid"|"expired"|"revoked"|"superseded",{title:string;message:string}>={
  invalid:{title:"This link is not valid",message:"Check that the complete private link was opened, or ask the shop for a new one."},
  expired:{title:"This link has expired",message:"For your protection, approval links expire automatically. Ask the shop to create a new link."},
  revoked:{title:"This link was revoked",message:"The shop has withdrawn this approval link. Contact them if you still need to review the estimate."},
  superseded:{title:"This estimate has changed",message:"This link no longer represents the current estimate. Ask the shop for a new approval link before deciding."},
};

export default async function EstimateApprovalPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<Query>}){
  const[{token},query]=await Promise.all([params,searchParams]);
  const validToken=estimateApprovalTokenSchema.safeParse(token);
  let approval:PublicEstimateApproval={state:"invalid"};
  if(validToken.success){try{approval=await getPublicEstimateApproval(validToken.data);}catch{approval={state:"invalid"};}}
  if(!("estimate" in approval)){
    const copy=stateCopy[approval.state];
    return <main id="public-estimate-page" className="grid min-h-screen place-items-center bg-zinc-100 p-4 sm:p-6"><Card id="public-estimate-state-card" className="w-full max-w-lg p-6 text-center sm:p-8"><p className="text-sm font-black text-amber-700">{verticalBrands.automotive.displayName} estimate review</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-zinc-600">{copy.message}</p><p className="mt-6 text-xs text-zinc-500">Do not send this private link to anyone else.</p></Card></main>;
  }

  const address=approval.branch.address.filter(Boolean).join(", ");
  const vehicle=[approval.job.vehicle.modelYear,approval.job.vehicle.make,approval.job.vehicle.model].filter(Boolean).join(" ")||"Vehicle";
  const decided=approval.state==="approved"||approval.state==="declined";
  return <main id="public-estimate-page" className="min-h-screen bg-zinc-100 px-4 py-5 text-zinc-950 sm:px-6 sm:py-8">
    <div id="public-estimate-content" className="mx-auto grid max-w-3xl gap-4">
      <header id="public-estimate-header" className="rounded-2xl bg-zinc-950 p-5 text-white sm:p-7">
        <p className="text-sm font-bold text-amber-400">{approval.business.name}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Estimate review</h1>
        <p className="mt-2 text-sm text-zinc-300">{approval.job.reference} · Estimate v{approval.estimate.version}</p>
      </header>
      {query.error?<p id="public-estimate-error" role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{query.error}</p>:null}
      {decided?<Card id="public-estimate-decision-card" className={`border-2 p-5 ${approval.state==="approved"?"border-emerald-300 bg-emerald-50":"border-red-200 bg-red-50"}`}><p className="text-sm font-bold uppercase">Decision recorded</p><h2 className="mt-1 text-2xl font-black capitalize">{approval.state}</h2><p className="mt-2 text-sm">This estimate was {approval.state}{approval.decidedAt?` on ${new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(approval.decidedAt))}`:""}. The first recorded decision is final for this link.</p></Card>:<Card id="public-estimate-security-note" className="border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Review every line and the total before deciding. Your response applies only to this exact estimate version and amount.</p></Card>}
      <Card id="public-estimate-job-card" className="p-5"><h2 className="font-black">Vehicle and shop</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Vehicle</dt><dd className="font-bold">{vehicle}</dd><dd>{approval.job.vehicle.plateNumber||"No plate provided"}</dd></div><div><dt className="text-zinc-500">Branch</dt><dd className="font-bold">{approval.branch.name}</dd>{address?<dd>{address}</dd>:null}{approval.branch.phone?<dd><a className="underline" href={`tel:${approval.branch.phone}`}>{approval.branch.phone}</a></dd>:null}{approval.branch.email?<dd><a className="break-all underline" href={`mailto:${approval.branch.email}`}>{approval.branch.email}</a></dd>:null}</div></dl></Card>
      <Card id="public-estimate-lines-card" className="overflow-hidden"><div className="border-b p-5"><h2 className="font-black">Estimate items</h2><p className="mt-1 text-xs text-zinc-500">Prices are in Philippine pesos.</p></div><div id="public-estimate-item-list" className="divide-y">{approval.estimate.items.map((item,index)=><article id={`public-estimate-item-${index+1}`} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:p-5" key={`${item.description}-${index}`}><div><h3 className="font-bold">{item.description}</h3><p className="mt-1 text-sm text-zinc-500">{item.quantity} × {formatMoney(item.unitPriceCentavos)}{item.discountCentavos?` · Discount ${formatMoney(item.discountCentavos)}`:""}</p></div><strong className="sm:text-right">{formatMoney(item.lineTotalCentavos)}</strong></article>)}</div><dl id="public-estimate-totals" className="ml-auto grid max-w-sm grid-cols-2 gap-2 border-t bg-zinc-50 p-5 text-sm"><dt>Subtotal</dt><dd className="text-right">{formatMoney(approval.estimate.subtotalCentavos)}</dd><dt>Discount</dt><dd className="text-right">-{formatMoney(approval.estimate.discountCentavos)}</dd><dt>Tax</dt><dd className="text-right">{formatMoney(approval.estimate.taxCentavos)}</dd><dt className="border-t pt-3 text-lg font-black">Total</dt><dd className="border-t pt-3 text-right text-lg font-black">{formatMoney(approval.estimate.totalCentavos)}</dd></dl></Card>
      {!decided?<Card id="public-estimate-decision-actions" className="p-5"><h2 className="font-black">Your decision</h2><p className="mt-1 text-sm text-zinc-600">This private link expires {new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(approval.expiresAt))}.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Button id="public-estimate-approve-button" asChild><Link href={`/estimate/${token}?confirm=approve`}>Approve estimate</Link></Button><Button id="public-estimate-decline-button" asChild variant="destructive"><Link href={`/estimate/${token}?confirm=decline`}>Decline estimate</Link></Button></div></Card>:null}
      <footer id="public-estimate-footer" className="px-3 pb-4 text-center text-xs text-zinc-500">This private page shows only the estimate needed for your decision. Keep the link confidential.</footer>
    </div>
    {!decided&&(query.confirm==="approve"||query.confirm==="decline")?<FormDialog id="public-estimate-confirmation-dialog" title={query.confirm==="approve"?"Approve this estimate?":"Decline this estimate?"} description={`Your decision applies to estimate v${approval.estimate.version} for ${formatMoney(approval.estimate.totalCentavos)}.`} closeHref={`/estimate/${token}`} size="md"><form id="public-estimate-decision-form" action={decideEstimateAction} className="grid gap-4"><input type="hidden" name="token" value={token}/><input type="hidden" name="decision" value={query.confirm}/><p className="rounded-xl bg-zinc-50 p-3 text-sm">{query.confirm==="approve"?"Approving authorizes the shop to proceed with the work listed in this estimate.":"Declining tells the shop not to proceed based on this estimate."}</p><label className="text-sm font-semibold">Comment (optional)<textarea id="public-estimate-comment-input" name="comment" maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border bg-white px-3 py-2" placeholder="Add a short note for the shop"/></label><div className="grid gap-2 sm:grid-cols-2"><Button id="public-estimate-cancel-decision-button" asChild variant="secondary"><Link href={`/estimate/${token}`}>Go back</Link></Button><SubmitButton id="public-estimate-confirm-decision-button" pendingText="Recording…" variant={query.confirm==="approve"?"primary":"destructive"}>{query.confirm==="approve"?"Yes, approve estimate":"Yes, decline estimate"}</SubmitButton></div></form></FormDialog>:null}
  </main>;
}
