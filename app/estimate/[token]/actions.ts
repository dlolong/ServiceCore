"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { formValue } from "@/lib/crm";
import { estimateApprovalCommentSchema, estimateApprovalTokenSchema } from "@/modules/automotive/work-execution/estimate-approval";
import { decidePublicEstimateApproval } from "@/modules/automotive/work-execution/estimate-approval.runtime";

const decisionSchema=z.object({token:estimateApprovalTokenSchema,decision:z.enum(["approve","decline"]),comment:estimateApprovalCommentSchema});

export async function decideEstimateAction(data:FormData){
  const token=formValue(data,"token");
  const parsed=decisionSchema.safeParse({token,decision:formValue(data,"decision"),comment:formValue(data,"comment")});
  if(!parsed.success)redirect(`/estimate/${encodeURIComponent(token)}?error=${encodeURIComponent("Check your response and try again.")}`);
  try{await decidePublicEstimateApproval(parsed.data.token,parsed.data.decision,parsed.data.comment);}
  catch{redirect(`/estimate/${parsed.data.token}?error=${encodeURIComponent("Your decision could not be recorded. Please try again.")}`);}
  redirect(`/estimate/${parsed.data.token}`);
}

