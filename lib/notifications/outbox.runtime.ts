import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaimedNotification, NotificationOutboxRepository } from "@/lib/notifications/outbox";

type OutboxRow={
  id:string;organization_id:string;recipient_customer_id:string;notification_type:string;channel:"email"|"sms";
  recipient_address:string|null;template_key:string;payload:unknown;deduplication_key:string;attempt_count:number;
  max_attempts:number;delivery_secret_id:string|null;expires_at:string|null;
};

function controlledDatabaseError(message:string,error:{message:string}|null):never{
  console.error("notification.database",{operation:message,error:error?.message??"unknown"});
  throw new Error(message);
}

export const notificationOutboxRepository:NotificationOutboxRepository={
  async claimBatch(input){
    const{data,error}=await createAdminClient().rpc("claim_notification_outbox_batch",{
      p_worker_id:input.workerId,p_batch_size:input.batchSize,p_lease_minutes:input.leaseMinutes,
    });
    if(error)controlledDatabaseError("Unable to claim notification work.",error);
    return((data??[]) as OutboxRow[]).map((row):ClaimedNotification=>({
      id:row.id,organizationId:row.organization_id,customerId:row.recipient_customer_id,
      notificationType:row.notification_type,channel:row.channel,recipientAddress:row.recipient_address,
      templateKey:row.template_key,payload:row.payload,deduplicationKey:row.deduplication_key,
      attemptCount:row.attempt_count,maxAttempts:row.max_attempts,deliverySecretId:row.delivery_secret_id,
      expiresAt:row.expires_at,
    }));
  },
  async getCurrentChannelOptIn(input){
    const{data,error}=await createAdminClient().from("customer_communication_preferences")
      .select("email_opt_in,sms_opt_in").eq("organization_id",input.organizationId).eq("customer_id",input.customerId).maybeSingle();
    if(error)controlledDatabaseError("Unable to evaluate notification eligibility.",error);
    return input.channel==="email"?Boolean(data?.email_opt_in):Boolean(data?.sms_opt_in);
  },
  async getDeliverySecret(secretId){
    const{data,error}=await createAdminClient().from("notification_delivery_secrets")
      .select("ciphertext,initialization_vector,authentication_tag,expires_at,destroyed_at")
      .eq("id",secretId).is("destroyed_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
    if(error)controlledDatabaseError("Unable to load secure notification material.",error);
    if(!data?.ciphertext||!data.initialization_vector||!data.authentication_tag)return null;
    return{ciphertext:data.ciphertext,initializationVector:data.initialization_vector,authenticationTag:data.authentication_tag};
  },
  async isClaimActive(input){
    const{data,error}=await createAdminClient().from("notification_outbox").select("id")
      .eq("id",input.outboxId).eq("status","processing").eq("locked_by",input.workerId).maybeSingle();
    if(error)controlledDatabaseError("Unable to verify notification claim.",error);
    return Boolean(data);
  },
  async recordResult(input){
    const{error}=await createAdminClient().rpc("record_notification_delivery_result",{
      p_outbox_id:input.outboxId,p_worker_id:input.workerId,p_result:input.result,p_provider:input.provider??null,
      p_provider_message_id:input.providerMessageId??null,p_error_code:input.errorCode??null,
      p_error_message:input.errorMessage??null,p_next_available_at:input.nextAvailableAt??null,
    });
    if(error)controlledDatabaseError("Unable to record notification delivery result.",error);
  },
};
