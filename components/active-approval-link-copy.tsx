"use client";

import { useActionState, useState } from "react";

import { recoverEstimateApprovalLinkAction, type RecoverApprovalLinkActionState } from "@/app/dashboard/jobs/advisor-actions";
import { SubmitButton } from "@/components/submit-button";

const initialState:RecoverApprovalLinkActionState={};

export function ActiveApprovalLinkCopy({jobId,linkId}:{jobId:string;linkId:string}){
  const[state,action]=useActionState(recoverEstimateApprovalLinkAction,initialState);
  const[copyStatus,setCopyStatus]=useState("");
  async function copy(){
    if(!state.approvalUrl)return;
    try{await navigator.clipboard.writeText(state.approvalUrl);setCopyStatus("Copied.");}
    catch{setCopyStatus("Copy failed. Select the link manually.");}
  }
  if(!state.approvalUrl)return <form id="job-order-approval-copy-link-form" action={action} className="mt-2 flex items-center gap-2">
    <input type="hidden" name="jobId" value={jobId}/><input type="hidden" name="linkId" value={linkId}/>
    <SubmitButton id="job-order-approval-copy-link-button" size="sm" variant="secondary" pendingText="Opening…">Copy active link</SubmitButton>
    {state.error?<span id="job-order-approval-copy-link-error" role="alert" className="text-red-700">{state.error}</span>:null}
  </form>;
  return <div id="job-order-approval-copy-link-result" className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
    <input id="job-order-approval-copy-link-output" className="min-h-9 min-w-0 rounded-lg border bg-white px-2" readOnly value={state.approvalUrl}/>
    <button id="job-order-approval-copy-link-confirm-button" type="button" onClick={copy} className="min-h-9 rounded-lg bg-brand-primary px-3 font-bold text-white hover:bg-brand-primary-strong">Copy link</button>
    {copyStatus?<span id="job-order-approval-copy-link-status" role="status" className="sm:col-span-2">{copyStatus}</span>:null}
  </div>;
}
