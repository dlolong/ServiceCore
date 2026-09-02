"use client";

import { useActionState, useState } from "react";

import { generateEstimateApprovalLinkAction, type ApprovalLinkActionState } from "@/app/dashboard/jobs/advisor-actions";
import { SubmitButton } from "@/components/submit-button";

const initialState:ApprovalLinkActionState={};

const reasonLabels:Record<string,string>={
  EMAIL_MISSING:"No email address",EMAIL_INVALID:"Invalid email address",EMAIL_OPTED_OUT:"Email opted out",
  SMS_MISSING:"No mobile number",SMS_INVALID:"Invalid Philippine mobile number",SMS_OPTED_OUT:"SMS opted out",
  DELIVERY_SECRET_UNAVAILABLE:"Automatic delivery is not configured",
};

export function EstimateApprovalLinkControls({jobId,estimateId,replacesActiveLink}:{jobId:string;estimateId:string;replacesActiveLink:boolean}){
  const[state,action]=useActionState(generateEstimateApprovalLinkAction,initialState);
  const[copyStatus,setCopyStatus]=useState("");
  async function copyLink(){
    if(!state.approvalUrl)return;
    try{await navigator.clipboard.writeText(state.approvalUrl);setCopyStatus("Copied to clipboard.");}
    catch{setCopyStatus("Copy failed. Select and copy the link manually.");}
  }
  return <div id="estimate-approval-link-controls" className="grid gap-4">
    {state.approvalUrl?<div id="estimate-approval-link-result" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <h3 className="font-black text-emerald-950">Private approval link created</h3>
      <p className="mt-1 text-sm text-emerald-900">Copy it now. KarKR cannot display this private URL again after you leave this result.</p>
      <input id="estimate-approval-link-output" className="mt-3 min-h-11 w-full rounded-xl border bg-white px-3 text-sm" readOnly value={state.approvalUrl}/>
      <button id="estimate-approval-link-copy-button" type="button" onClick={copyLink} className="mt-3 min-h-11 rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white">Copy link</button>
      {copyStatus?<p id="estimate-approval-link-copy-status" role="status" className="mt-2 text-sm">{copyStatus}</p>:null}
      <p className="mt-2 text-xs text-zinc-600">Expires {state.expiresAt?new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(state.expiresAt)):"automatically"}.</p>
      {state.delivery?<div id="estimate-approval-delivery-result" className="mt-3 grid gap-1 border-t border-emerald-200 pt-3 text-xs">
        {(["email","sms"] as const).map(channel=>{const delivery=state.delivery![channel];return <div id={`estimate-approval-${channel}-delivery-result`} className="flex justify-between gap-3" key={channel}><span className="capitalize">{channel}</span><strong>{delivery.status==="pending"?"Queued":reasonLabels[delivery.reason??""]??"Not eligible"}</strong></div>})}
        {Object.values(state.delivery).every(item=>item.status!=="pending")?<p className="mt-1 text-zinc-600">No eligible email or SMS destination is available. Use Copy link to share it manually.</p>:null}
      </div>:null}
    </div>:<form id="estimate-approval-link-generate-form" action={action} className="grid gap-3">
      <input type="hidden" name="jobId" value={jobId}/><input type="hidden" name="estimateId" value={estimateId}/>
      {replacesActiveLink?<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Generating a replacement immediately revokes the current link.</p>:null}
      <p className="text-sm text-zinc-600">The customer can review this exact estimate and approve or decline without signing in. The link expires in 7 days.</p>
      <SubmitButton id="estimate-approval-link-generate-button" pendingText="Generating…">{replacesActiveLink?"Generate replacement link":"Generate approval link"}</SubmitButton>
    </form>}
    {state.error?<p id="estimate-approval-link-error" role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{state.error}</p>:null}
  </div>;
}
