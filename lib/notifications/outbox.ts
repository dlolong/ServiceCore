import { decryptDeliverySecret, type EncryptedDeliverySecret } from "@/lib/notifications/delivery-secret";
import { evaluateNotificationDeliveryEligibility, type NotificationChannel } from "@/lib/notifications/eligibility";
import { DeliveryProviderError, type DeliveryProviders } from "@/lib/notifications/providers";

export const NOTIFICATION_OUTBOX_BATCH_SIZE=25;
export const NOTIFICATION_PROCESSING_LEASE_MINUTES=15;
export const NOTIFICATION_MAX_ATTEMPTS=6;
const RETRY_DELAYS_MINUTES=[1,5,15,60,360] as const;

export type ClaimedNotification={
  id:string;organizationId:string;customerId:string;notificationType:string;channel:NotificationChannel;
  recipientAddress:string|null;templateKey:string;payload:unknown;deduplicationKey:string;
  attemptCount:number;maxAttempts:number;deliverySecretId:string|null;expiresAt:string|null;
};

export type RenderedNotification={subject?:string;body:string};
export type NotificationTemplateRenderer=(input:{templateKey:string;payload:unknown;deliverySecret:string|null})=>RenderedNotification;

export interface NotificationOutboxRepository{
  claimBatch(input:{workerId:string;batchSize:number;leaseMinutes:number}):Promise<ClaimedNotification[]>;
  getCurrentChannelOptIn(input:{organizationId:string;customerId:string;channel:NotificationChannel}):Promise<boolean>;
  getDeliverySecret(secretId:string):Promise<EncryptedDeliverySecret|null>;
  isClaimActive(input:{outboxId:string;workerId:string}):Promise<boolean>;
  recordResult(input:{
    outboxId:string;workerId:string;result:"sent"|"retry"|"failed"|"cancelled";provider?:string;
    providerMessageId?:string;errorCode?:string;errorMessage?:string;nextAvailableAt?:string;
  }):Promise<void>;
}

export type ProcessOutboxResult={claimed:number;sent:number;retried:number;failed:number;cancelled:number};

export function notificationRetryAt(attemptNumber:number,now=new Date()){
  const delay=RETRY_DELAYS_MINUTES[Math.min(Math.max(attemptNumber-1,0),RETRY_DELAYS_MINUTES.length-1)];
  return new Date(now.getTime()+delay*60_000);
}

function safeErrorMessage(error:unknown){
  const message=error instanceof Error?error.message:"Notification delivery failed.";
  return message.replace(/https?:\/\/\S+/gi,"[secure-link-redacted]").slice(0,500);
}

export async function processNotificationOutboxBatch(input:{
  repository:NotificationOutboxRepository;providers:DeliveryProviders;render:NotificationTemplateRenderer;
  workerId:string;deliverySecretKey?:string;batchSize?:number;now?:Date;
}):Promise<ProcessOutboxResult>{
  const rows=await input.repository.claimBatch({
    workerId:input.workerId,batchSize:input.batchSize??NOTIFICATION_OUTBOX_BATCH_SIZE,
    leaseMinutes:NOTIFICATION_PROCESSING_LEASE_MINUTES,
  });
  const result:ProcessOutboxResult={claimed:rows.length,sent:0,retried:0,failed:0,cancelled:0};

  for(const row of rows){
    const provider=input.providers[row.channel];
    const optedIn=await input.repository.getCurrentChannelOptIn({
      organizationId:row.organizationId,customerId:row.customerId,channel:row.channel,
    });
    const eligibility=evaluateNotificationDeliveryEligibility({channel:row.channel,recipientAddress:row.recipientAddress,optedIn});
    if(!eligibility.eligible){
      await input.repository.recordResult({outboxId:row.id,workerId:input.workerId,result:"cancelled",errorCode:eligibility.reason});
      result.cancelled++;continue;
    }
    if(!provider.configured){
      await input.repository.recordResult({outboxId:row.id,workerId:input.workerId,result:"cancelled",provider:provider.name,errorCode:"CHANNEL_DISABLED"});
      result.cancelled++;continue;
    }
    let deliverySecret:string|null=null;
    let rendered:RenderedNotification;
    try{
      if(row.deliverySecretId){
        if(!input.deliverySecretKey)throw new Error("Delivery secret key unavailable.");
        const encryptedSecret=await input.repository.getDeliverySecret(row.deliverySecretId);
        if(!encryptedSecret)throw new Error("Delivery secret unavailable.");
        deliverySecret=decryptDeliverySecret(encryptedSecret,input.deliverySecretKey);
      }
      rendered=input.render({templateKey:row.templateKey,payload:row.payload,deliverySecret});
    }catch(error){
      await input.repository.recordResult({outboxId:row.id,workerId:input.workerId,result:"cancelled",provider:provider.name,errorCode:"MESSAGE_CONFIGURATION_INVALID",errorMessage:safeErrorMessage(error)});
      result.cancelled++;continue;
    }
    // A decision/revocation trigger may cancel a claimed row while its message
    // is being prepared. Recheck the generic claim immediately before send.
    if(!await input.repository.isClaimActive({outboxId:row.id,workerId:input.workerId})){
      result.cancelled++;continue;
    }

    try{
      const providerResult=await provider.send({
        notificationId:row.id,to:row.recipientAddress!,subject:rendered.subject,body:rendered.body,
        idempotencyKey:row.deduplicationKey,templateKey:row.templateKey,
      });
      if(!providerResult.accepted)throw new DeliveryProviderError("PROVIDER_REJECTED","The provider did not accept the message.",false);
      await input.repository.recordResult({outboxId:row.id,workerId:input.workerId,result:"sent",provider:provider.name,providerMessageId:providerResult.providerMessageId??undefined});
      result.sent++;
      console.info("notification.delivery",{operation:"sent",outboxId:row.id,organizationId:row.organizationId,notificationType:row.notificationType,channel:row.channel,attempt:row.attemptCount+1,provider:provider.name});
    }catch(error){
      const retryable=error instanceof DeliveryProviderError?error.retryable:true;
      const reachesMaximum=row.attemptCount+1>=Math.min(row.maxAttempts,NOTIFICATION_MAX_ATTEMPTS);
      const outcome=retryable&&!reachesMaximum?"retry":"failed";
      await input.repository.recordResult({
        outboxId:row.id,workerId:input.workerId,result:outcome,provider:provider.name,
        errorCode:error instanceof DeliveryProviderError?error.code:"PROVIDER_TEMPORARY_FAILURE",
        errorMessage:safeErrorMessage(error),
        nextAvailableAt:outcome==="retry"?notificationRetryAt(row.attemptCount+1,input.now).toISOString():undefined,
      });
      if(outcome==="retry")result.retried++;else result.failed++;
      console.warn("notification.delivery",{operation:outcome,outboxId:row.id,organizationId:row.organizationId,notificationType:row.notificationType,channel:row.channel,attempt:row.attemptCount+1,provider:provider.name});
    }
  }
  return result;
}
