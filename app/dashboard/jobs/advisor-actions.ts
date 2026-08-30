"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDashboardContext } from "@/lib/auth/context";
import { formValue } from "@/lib/crm";
import { clientEnv } from "@/lib/env/client";
import { parseMoneyToCentavos } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { createEstimateApprovalLink, revokeEstimateApprovalLink } from "@/modules/automotive/work-execution/estimate-approval";
import { recordCustomerAuthorization, saveEstimateItem } from "@/modules/automotive/work-execution/job-order.service";

function go(jobId:string,kind:"message"|"error",message:string):never { redirect(`/dashboard/jobs/${jobId}?${kind}=${encodeURIComponent(message)}`); }
const itemSchema=z.object({jobId:z.uuid(),estimateId:z.uuid(),itemId:z.union([z.literal(""),z.uuid()]),itemType:z.enum(["service","part","product","other"]),inventoryItemId:z.union([z.literal(""),z.uuid()]),description:z.string().trim().min(1).max(300),quantity:z.coerce.number().int().min(1).max(1000),unitPrice:z.string().trim().min(1),discount:z.string().trim().default("0")});
const authorizationSchema=z.object({jobId:z.uuid(),estimateId:z.uuid(),decision:z.enum(["approve","decline"]),method:z.enum(["in_person","phone","sms","messenger","email","other"]),note:z.string().trim().max(1000)});
const paymentSchema=z.object({jobId:z.uuid(),invoiceId:z.uuid(),amount:z.string().trim().min(1),method:z.enum(["cash","gcash","maya","bank_transfer","card","other"]),reference:z.string().trim().max(100),notes:z.string().trim().max(1000)});

export type ApprovalLinkActionState={approvalUrl?:string;expiresAt?:string;error?:string};

export async function generateEstimateApprovalLinkAction(_previous:ApprovalLinkActionState,data:FormData):Promise<ApprovalLinkActionState>{
  const parsed=z.object({jobId:z.uuid(),estimateId:z.uuid()}).safeParse({jobId:formValue(data,"jobId"),estimateId:formValue(data,"estimateId")});
  if(!parsed.success)return{error:"The current estimate could not be identified. Refresh and try again."};
  try{
    const created=await createEstimateApprovalLink(parsed.data.estimateId);
    const approvalUrl=new URL(`/estimate/${created.token}`,clientEnv.NEXT_PUBLIC_APP_URL).toString();
    revalidatePath(`/dashboard/jobs/${parsed.data.jobId}`);
    return{approvalUrl,expiresAt:created.expiresAt};
  }catch(error){return{error:error instanceof Error?error.message:"Unable to create an approval link."};}
}

export async function revokeEstimateApprovalLinkAction(data:FormData){
  const parsed=z.object({jobId:z.uuid(),linkId:z.uuid()}).safeParse({jobId:formValue(data,"jobId"),linkId:formValue(data,"linkId")});
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error","The approval link could not be identified.");
  try{await revokeEstimateApprovalLink(parsed.data.linkId);}catch(error){go(jobId,"error",error instanceof Error?error.message:"Unable to revoke the approval link.");}
  revalidatePath(`/dashboard/jobs/${parsed.data.jobId}`);go(parsed.data.jobId,"message","Customer approval link revoked.");
}

export async function saveAdvisorEstimateItem(data:FormData) {
  const parsed=itemSchema.safeParse(Object.fromEntries(["jobId","estimateId","itemId","itemType","inventoryItemId","description","quantity","unitPrice","discount"].map(key=>[key,formValue(data,key)])));
  const jobId=formValue(data,"jobId"); if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Estimate item is invalid.");
  const unitPrice=parseMoneyToCentavos(parsed.data.unitPrice),discount=parseMoneyToCentavos(parsed.data.discount||"0"); if(unitPrice===null||discount===null)go(jobId,"error","Enter valid PHP amounts.");
  try { await saveEstimateItem({estimateId:parsed.data.estimateId,itemId:parsed.data.itemId||null,itemType:parsed.data.itemType,inventoryItemId:parsed.data.inventoryItemId||null,description:parsed.data.description,quantity:parsed.data.quantity,unitPriceCentavos:Number(unitPrice),discountCentavos:Number(discount)}); }
  catch(error){go(jobId,"error",error instanceof Error?error.message:"Unable to save estimate item.");}
  revalidatePath(`/dashboard/jobs/${jobId}`); go(jobId,"message","Estimate item saved. Customer authorization was reset if the approved amount changed.");
}

export async function recordAdvisorAuthorization(data:FormData) {
  const parsed=authorizationSchema.safeParse(Object.fromEntries(["jobId","estimateId","decision","method","note"].map(key=>[key,formValue(data,key)]))); const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Authorization details are invalid.");
  try { await recordCustomerAuthorization({estimateId:parsed.data.estimateId,decision:parsed.data.decision,method:parsed.data.method,note:parsed.data.note||null}); }
  catch(error){go(jobId,"error",error instanceof Error?error.message:"Could not record authorization.");}
  revalidatePath(`/dashboard/jobs/${jobId}`); go(jobId,"message",parsed.data.decision==="approve"?"Customer authorization recorded.":"Customer decline recorded.");
}

export async function recordAdvisorPayment(data:FormData) {
  const parsed=paymentSchema.safeParse(Object.fromEntries(["jobId","invoiceId","amount","method","reference","notes"].map(key=>[key,formValue(data,key)]))); const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Payment details are invalid.");
  const amount=parseMoneyToCentavos(parsed.data.amount); if(amount===null||amount<=0)go(jobId,"error","Enter a payment amount greater than zero.");
  await getDashboardContext(); const supabase=await createClient(); const {error}=await supabase.rpc("record_invoice_payment",{p_invoice_id:parsed.data.invoiceId,p_amount_centavos:Number(amount),p_method:parsed.data.method,p_reference:parsed.data.reference||null,p_notes:parsed.data.notes||null});
  if(error)go(jobId,"error","Payment was not recorded. No financial data was changed.");
  revalidatePath(`/dashboard/jobs/${jobId}`); go(jobId,"message","Payment recorded.");
}
