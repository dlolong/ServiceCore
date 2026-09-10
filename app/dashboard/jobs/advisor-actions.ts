"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAutomotiveContext as getDashboardContext } from "@/lib/auth/industry-access";
import { formValue } from "@/lib/crm";
import { clientEnv } from "@/lib/env/client";
import { reportActionError } from "@/lib/errors/action-error";
import { parseMoneyToCentavos } from "@/lib/operations";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createEstimateApprovalLink, revokeEstimateApprovalLink } from "@/modules/automotive/work-execution/estimate-approval";
import { recoverActiveEstimateApprovalToken } from "@/modules/automotive/work-execution/estimate-approval.runtime";
import { consumeJobOrderPart, releaseJobOrderPart, reserveJobOrderPart, reserveRequiredJobOrderParts } from "@/modules/automotive/work-execution/job-parts.service";
import { recordCustomerAuthorization, saveEstimateItem } from "@/modules/automotive/work-execution/job-order.service";

function go(jobId:string,kind:"message"|"error",message:string):never { redirect(`/dashboard/jobs/${jobId}?${kind}=${encodeURIComponent(message)}`); }
async function createClient(){await getDashboardContext();return createSupabaseClient()}
const itemSchema=z.object({jobId:z.uuid(),estimateId:z.uuid(),itemId:z.union([z.literal(""),z.uuid()]),itemType:z.enum(["service","part","product","other"]),inventoryItemId:z.union([z.literal(""),z.uuid()]),description:z.string().trim().min(1).max(300),quantity:z.coerce.number().int().min(1).max(1000),unitPrice:z.string().trim().min(1),discount:z.string().trim().default("0")});
const authorizationSchema=z.object({jobId:z.uuid(),estimateId:z.uuid(),decision:z.enum(["approve","decline"]),method:z.enum(["in_person","phone","sms","messenger","email","other"]),note:z.string().trim().max(1000)});
const paymentSchema=z.object({jobId:z.uuid(),invoiceId:z.uuid(),amount:z.string().trim().min(1),method:z.enum(["cash","gcash","maya","bank_transfer","card","other"]),reference:z.string().trim().max(100),notes:z.string().trim().max(1000)});
const reservePartSchema=z.object({jobId:z.uuid(),inventoryItemId:z.uuid(),quantity:z.coerce.number().positive().max(999999999).multipleOf(0.001),idempotencyKey:z.string().trim().min(1).max(200)});
const reservationMutationSchema=z.object({jobId:z.uuid(),reservationId:z.uuid(),quantity:z.coerce.number().positive().max(999999999).multipleOf(0.001),idempotencyKey:z.string().trim().min(1).max(200)});
const reserveAllSchema=z.object({jobId:z.uuid(),idempotencyKey:z.string().trim().min(1).max(200)});

export type ApprovalLinkActionState={
  approvalUrl?:string;expiresAt?:string;error?:string;
  delivery?:{email:{status:string;reason:string|null};sms:{status:string;reason:string|null}};
};
export type RecoverApprovalLinkActionState={approvalUrl?:string;error?:string};

export async function recoverEstimateApprovalLinkAction(_previous:RecoverApprovalLinkActionState,data:FormData):Promise<RecoverApprovalLinkActionState>{
  const parsed=z.object({jobId:z.uuid(),linkId:z.uuid()}).safeParse({jobId:formValue(data,"jobId"),linkId:formValue(data,"linkId")});
  if(!parsed.success)return{error:"The active approval link could not be identified."};
  try{
    const token=await recoverActiveEstimateApprovalToken({jobOrderId:parsed.data.jobId,linkId:parsed.data.linkId});
    return{approvalUrl:new URL(`/estimate/${token}`,clientEnv.NEXT_PUBLIC_APP_URL).toString()};
  }catch(error){return{error:reportActionError("estimate_approval.recover",error,"The active approval link could not be displayed.")};}
}

export async function generateEstimateApprovalLinkAction(_previous:ApprovalLinkActionState,data:FormData):Promise<ApprovalLinkActionState>{
  const parsed=z.object({jobId:z.uuid(),estimateId:z.uuid()}).safeParse({jobId:formValue(data,"jobId"),estimateId:formValue(data,"estimateId")});
  if(!parsed.success)return{error:"The current estimate could not be identified. Refresh and try again."};
  try{
    const created=await createEstimateApprovalLink(parsed.data.estimateId);
    const approvalUrl=new URL(`/estimate/${created.token}`,clientEnv.NEXT_PUBLIC_APP_URL).toString();
    revalidatePath(`/dashboard/jobs/${parsed.data.jobId}`);
    return{approvalUrl,expiresAt:created.expiresAt,delivery:created.delivery};
  }catch(error){return{error:reportActionError("estimate_approval.create",error,"Unable to create an approval link.")};}
}

export async function retryEstimateApprovalNotificationAction(data:FormData){
  const parsed=z.object({jobId:z.uuid(),outboxId:z.uuid()}).safeParse({jobId:formValue(data,"jobId"),outboxId:formValue(data,"outboxId")});
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error","The failed notification could not be identified.");
  await getDashboardContext();
  const supabase=await createClient();
  const{error}=await supabase.rpc("retry_notification_outbox",{p_outbox_id:parsed.data.outboxId});
  if(error)go(parsed.data.jobId,"error",error.message.toLowerCase().includes("no longer active")?"The approval link is no longer active.":"The notification could not be retried.");
  revalidatePath(`/dashboard/jobs/${parsed.data.jobId}`);
  go(parsed.data.jobId,"message","Notification queued for retry.");
}

export async function revokeEstimateApprovalLinkAction(data:FormData){
  const parsed=z.object({jobId:z.uuid(),linkId:z.uuid()}).safeParse({jobId:formValue(data,"jobId"),linkId:formValue(data,"linkId")});
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error","The approval link could not be identified.");
  try{await revokeEstimateApprovalLink(parsed.data.linkId);}catch(error){go(jobId,"error",reportActionError("estimate_approval.revoke",error,"Unable to revoke the approval link."));}
  revalidatePath(`/dashboard/jobs/${parsed.data.jobId}`);go(parsed.data.jobId,"message","Customer approval link revoked.");
}

export async function saveAdvisorEstimateItem(data:FormData) {
  const parsed=itemSchema.safeParse(Object.fromEntries(["jobId","estimateId","itemId","itemType","inventoryItemId","description","quantity","unitPrice","discount"].map(key=>[key,formValue(data,key)])));
  const jobId=formValue(data,"jobId"); if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Estimate item is invalid.");
  const unitPrice=parseMoneyToCentavos(parsed.data.unitPrice),discount=parseMoneyToCentavos(parsed.data.discount||"0"); if(unitPrice===null||discount===null)go(jobId,"error","Enter valid PHP amounts.");
  try { await saveEstimateItem({estimateId:parsed.data.estimateId,itemId:parsed.data.itemId||null,itemType:parsed.data.itemType,inventoryItemId:parsed.data.inventoryItemId||null,description:parsed.data.description,quantity:parsed.data.quantity,unitPriceCentavos:Number(unitPrice),discountCentavos:Number(discount)}); }
  catch(error){go(jobId,"error",reportActionError("estimate.item_save",error,"Unable to save the estimate item."));}
  revalidatePath(`/dashboard/jobs/${jobId}`); go(jobId,"message","Estimate item saved. Customer authorization was reset if the approved amount changed.");
}

export async function recordAdvisorAuthorization(data:FormData) {
  const parsed=authorizationSchema.safeParse(Object.fromEntries(["jobId","estimateId","decision","method","note"].map(key=>[key,formValue(data,key)]))); const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Authorization details are invalid.");
  try { await recordCustomerAuthorization({estimateId:parsed.data.estimateId,decision:parsed.data.decision,method:parsed.data.method,note:parsed.data.note||null}); }
  catch(error){go(jobId,"error",reportActionError("estimate.authorization",error,"Could not record authorization."));}
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

export async function reserveAdvisorJobPart(data:FormData) {
  const parsed=reservePartSchema.safeParse(Object.fromEntries(["jobId","inventoryItemId","quantity","idempotencyKey"].map(key=>[key,formValue(data,key)])));
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Reservation details are invalid.");
  try{await reserveJobOrderPart({jobOrderId:parsed.data.jobId,inventoryItemId:parsed.data.inventoryItemId,quantity:parsed.data.quantity,idempotencyKey:parsed.data.idempotencyKey});}
  catch(error){go(jobId,"error",reportActionError("job_parts.reserve",error,"Unable to reserve this part."));}
  revalidatePath(`/dashboard/jobs/${jobId}`);go(jobId,"message","Part reserved for this Job Order.");
}

export async function reserveAdvisorRequiredJobParts(data:FormData) {
  const parsed=reserveAllSchema.safeParse({jobId:formValue(data,"jobId"),idempotencyKey:formValue(data,"idempotencyKey")});
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error","The Job Order could not be identified.");
  try{await reserveRequiredJobOrderParts({jobOrderId:parsed.data.jobId,idempotencyKey:parsed.data.idempotencyKey});}
  catch(error){go(jobId,"error",reportActionError("job_parts.reserve_required",error,"Unable to reserve the required parts."));}
  revalidatePath(`/dashboard/jobs/${jobId}`);go(jobId,"message","Available required parts reserved.");
}

export async function consumeAdvisorJobPart(data:FormData) {
  const parsed=reservationMutationSchema.safeParse(Object.fromEntries(["jobId","reservationId","quantity","idempotencyKey"].map(key=>[key,formValue(data,key)])));
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Part usage details are invalid.");
  try{await consumeJobOrderPart({jobOrderId:parsed.data.jobId,reservationId:parsed.data.reservationId,quantity:parsed.data.quantity,idempotencyKey:parsed.data.idempotencyKey});}
  catch(error){go(jobId,"error",reportActionError("job_parts.consume",error,"Unable to record part usage."));}
  revalidatePath(`/dashboard/jobs/${jobId}`);go(jobId,"message","Part usage recorded and physical stock updated.");
}

export async function releaseAdvisorJobPart(data:FormData) {
  const parsed=reservationMutationSchema.safeParse(Object.fromEntries(["jobId","reservationId","quantity","idempotencyKey"].map(key=>[key,formValue(data,key)])));
  const jobId=formValue(data,"jobId");
  if(!parsed.success)go(jobId,"error",parsed.error.issues[0]?.message??"Release details are invalid.");
  try{await releaseJobOrderPart({jobOrderId:parsed.data.jobId,reservationId:parsed.data.reservationId,quantity:parsed.data.quantity,idempotencyKey:parsed.data.idempotencyKey});}
  catch(error){go(jobId,"error",reportActionError("job_parts.release",error,"Unable to release this reservation."));}
  revalidatePath(`/dashboard/jobs/${jobId}`);go(jobId,"message","Unused reservation released. Physical stock was not changed.");
}
