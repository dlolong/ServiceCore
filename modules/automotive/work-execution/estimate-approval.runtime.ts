import "server-only";

import { getDashboardContext } from "@/lib/auth/context";
import { serverEnv } from "@/lib/env/server";
import { decryptDeliverySecret } from "@/lib/notifications/delivery-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  EstimateApprovalError,
  type EstimateApprovalLinkPersistence,
  estimateApprovalTokenSchema,
  hashEstimateApprovalToken,
  parsePublicEstimateApproval,
} from "@/modules/automotive/work-execution/estimate-approval";

function controlledError(error: { message: string } | null, fallback: string): never {
  const safeMessages = ["current undecided estimate", "no longer active", "estimate not found"];
  throw new EstimateApprovalError(error && safeMessages.some((part) => error.message.toLowerCase().includes(part)) ? error.message : fallback);
}

export const estimateApprovalLinkPersistence: EstimateApprovalLinkPersistence = {
  async create(input) {
    await getDashboardContext();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_estimate_approval_link", {
      p_estimate_id: input.estimateId,
      p_token_hash: input.tokenHash,
      p_expires_at: input.expiresAt,
      p_secret_ciphertext:input.deliverySecret?.ciphertext??null,
      p_secret_initialization_vector:input.deliverySecret?.initializationVector??null,
      p_secret_authentication_tag:input.deliverySecret?.authenticationTag??null,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result) controlledError(error, "Unable to create an approval link.");
    return {
      linkId:result.link_id as string,expiresAt:result.expires_at as string,
      delivery:{
        email:{status:result.email_status as string,reason:(result.email_reason as string|null)??null},
        sms:{status:result.sms_status as string,reason:(result.sms_reason as string|null)??null},
      },
    };
  },
  async revoke(linkId) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoke_estimate_approval_link", { p_link_id: linkId });
    if (error) controlledError(error, "Unable to revoke the approval link.");
  },
};

export async function getPublicEstimateApproval(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_estimate_approval", { p_token_hash: hashEstimateApprovalToken(token) });
  if (error) throw new EstimateApprovalError("This estimate cannot be displayed right now.");
  return parsePublicEstimateApproval(data);
}

export async function decidePublicEstimateApproval(token: string, decision: "approve" | "decline", comment: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_public_estimate_approval", {
    p_token_hash: hashEstimateApprovalToken(token),
    p_decision: decision,
    p_comment: comment || null,
  });
  if (error || !data || typeof data !== "object" || !("state" in data)) throw new EstimateApprovalError("Your decision could not be recorded. Please try again.");
  return data as { state: string; idempotent?: boolean };
}

export async function recoverActiveEstimateApprovalToken(input:{jobOrderId:string;linkId:string}){
  const{activeMembership}=await getDashboardContext();
  const supabase=await createClient();
  const{data:visibleLink}=await supabase.from("estimate_approval_links")
    .select("id,status,expires_at").eq("id",input.linkId).eq("job_order_id",input.jobOrderId)
    .eq("organization_id",activeMembership.organizationId).maybeSingle();
  if(!visibleLink||visibleLink.status!=="active"||new Date(visibleLink.expires_at)<=new Date()){
    throw new EstimateApprovalError("The approval link is no longer active.");
  }
  if(!serverEnv.NOTIFICATION_LINK_ENCRYPTION_KEY){
    throw new EstimateApprovalError("This link cannot be displayed again. Generate a replacement to copy it.");
  }
  const admin=createAdminClient();
  const{data:protectedLink}=await admin.from("estimate_approval_links").select("delivery_secret_id")
    .eq("id",visibleLink.id).eq("organization_id",activeMembership.organizationId).maybeSingle();
  if(!protectedLink?.delivery_secret_id){
    throw new EstimateApprovalError("This link cannot be displayed again. Generate a replacement to copy it.");
  }
  const{data:secret}=await admin.from("notification_delivery_secrets")
    .select("ciphertext,initialization_vector,authentication_tag,expires_at,destroyed_at")
    .eq("id",protectedLink.delivery_secret_id).eq("organization_id",activeMembership.organizationId)
    .is("destroyed_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!secret?.ciphertext||!secret.initialization_vector||!secret.authentication_tag){
    throw new EstimateApprovalError("This link cannot be displayed again. Generate a replacement to copy it.");
  }
  try{
    return estimateApprovalTokenSchema.parse(decryptDeliverySecret({
      ciphertext:secret.ciphertext,initializationVector:secret.initialization_vector,authenticationTag:secret.authentication_tag,
    },serverEnv.NOTIFICATION_LINK_ENCRYPTION_KEY));
  }catch{
    throw new EstimateApprovalError("This link cannot be displayed again. Generate a replacement to copy it.");
  }
}
