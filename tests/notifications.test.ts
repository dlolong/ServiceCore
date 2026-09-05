import assert from "node:assert/strict";
import test from "node:test";

import { isAuthorizedNotificationCron } from "../lib/notifications/cron-auth";
import { decryptDeliverySecret, encryptDeliverySecret } from "../lib/notifications/delivery-secret";
import { evaluateNotificationDeliveryEligibility, normalizeNotificationEmail, normalizePhilippineMobile } from "../lib/notifications/eligibility";
import {
  notificationRetryAt,processNotificationOutboxBatch,type ClaimedNotification,type NotificationOutboxRepository,
} from "../lib/notifications/outbox";
import {
  createDeliveryProviders,DeliveryProviderError,type DeliveryProviderMessage,type DeliveryProviderResult,type NotificationDeliveryProvider,
} from "../lib/notifications/providers";
import { renderEstimateApprovalNotification } from "../modules/automotive/notifications/estimate-approval.templates";
import { renderAutomotiveNotification } from "../modules/automotive/notifications/automotive-notification.templates";
import { renderVehicleMaintenanceNotification } from "../modules/automotive/notifications/vehicle-maintenance.templates";

const encryptionKey=Buffer.alloc(32,7).toString("base64");
const rawToken="A".repeat(43);

function claimed(overrides:Partial<ClaimedNotification>={}):ClaimedNotification{return{
  id:"10000000-0000-4000-8000-000000000001",organizationId:"20000000-0000-4000-8000-000000000001",
  customerId:"30000000-0000-4000-8000-000000000001",notificationType:"ESTIMATE_AWAITING_APPROVAL",channel:"email",
  recipientAddress:"customer@example.com",templateKey:"estimate-awaiting-approval-email-v1",
  payload:{businessName:"KarKR Auto Care",branchName:"Main",vehicleLabel:"Toyota Vios",plateNumber:"ABC 123",
    amountCentavos:850000,expiresAt:"2026-09-06T00:00:00.000Z"},
  deduplicationKey:"estimate-approval:link:v1:email:initial",attemptCount:0,maxAttempts:6,
  deliverySecretId:"40000000-0000-4000-8000-000000000001",expiresAt:"2026-09-06T00:00:00.000Z",...overrides,
};}

class MemoryRepository implements NotificationOutboxRepository{
  results:Array<Parameters<NotificationOutboxRepository["recordResult"]>[0]>=[];
  constructor(public rows:ClaimedNotification[],public optedIn=true,public encrypted=encryptDeliverySecret(rawToken,encryptionKey)){}
  async claimBatch(){return this.rows;}
  async getCurrentChannelOptIn(){return this.optedIn;}
  async getDeliverySecret(){return this.encrypted;}
  async isClaimActive(){return true;}
  async recordResult(input:Parameters<NotificationOutboxRepository["recordResult"]>[0]){this.results.push(input);}
}

class StubProvider implements NotificationDeliveryProvider{
  readonly name="stub";readonly configured=true;calls:DeliveryProviderMessage[]=[];
  constructor(private result:DeliveryProviderResult|Error={accepted:true,providerMessageId:"provider-1"}){}
  async send(message:DeliveryProviderMessage){this.calls.push(message);if(this.result instanceof Error)throw this.result;return this.result;}
}

test("Philippine mobile normalization accepts canonical local forms and rejects ambiguous numbers",()=>{
  assert.equal(normalizePhilippineMobile("0917 123 4567"),"+639171234567");
  assert.equal(normalizePhilippineMobile("+639171234567"),"+639171234567");
  assert.equal(normalizePhilippineMobile("639171234567"),"+639171234567");
  assert.equal(normalizePhilippineMobile("9171234567"),null);
  assert.equal(normalizePhilippineMobile("+14155552671"),null);
});

test("channel eligibility uses normalized snapshots and current explicit opt-in",()=>{
  assert.equal(normalizeNotificationEmail(" Customer@Example.COM "),"customer@example.com");
  assert.deepEqual(evaluateNotificationDeliveryEligibility({channel:"email",recipientAddress:"customer@example.com",optedIn:true}),{eligible:true,reason:"ELIGIBLE"});
  assert.deepEqual(evaluateNotificationDeliveryEligibility({channel:"email",recipientAddress:"customer@example.com",optedIn:false}),{eligible:false,reason:"EMAIL_OPTED_OUT"});
  assert.deepEqual(evaluateNotificationDeliveryEligibility({channel:"sms",recipientAddress:null,optedIn:true}),{eligible:false,reason:"SMS_MISSING"});
});

test("delivery secrets use authenticated encryption and round trip without plaintext storage",()=>{
  const encrypted=encryptDeliverySecret(rawToken,encryptionKey);
  assert.notEqual(encrypted.ciphertext,rawToken);
  assert.equal(JSON.stringify(encrypted).includes(rawToken),false);
  assert.equal(decryptDeliverySecret(encrypted,encryptionKey),rawToken);
  assert.throws(()=>decryptDeliverySecret(encrypted,Buffer.alloc(32,8).toString("base64")));
});

test("automotive templates inject the private URL only immediately before provider send",()=>{
  const payload=claimed().payload;
  assert.equal(JSON.stringify(payload).includes(rawToken),false);
  const message=renderEstimateApprovalNotification("https://karkr.example")({
    templateKey:"estimate-awaiting-approval-email-v1",payload,deliverySecret:rawToken,
  });
  assert.match(message.body,/Toyota Vios/);
  assert.match(message.body,/https:\/\/karkr\.example\/estimate\//);
  assert.match(message.subject??"",/estimate is ready/i);
});

test("maintenance templates render due context without a delivery secret",()=>{
  const message=renderVehicleMaintenanceNotification({
    templateKey:"vehicle-maintenance-due_soon-email-v1",deliverySecret:null,payload:{
      businessName:"KarKR Auto Care",branchName:"Main",branchPhone:"09171234567",branchEmail:null,
      customerName:"Juan Dela Cruz",vehicleLabel:"Toyota Vios",plateNumber:"ABC 123",serviceName:"Oil change",
      lastServiceAt:"2026-03-01T00:00:00.000Z",lastServiceOdometerKm:40000,
      nextDueAt:"2026-09-01T00:00:00.000Z",nextDueOdometerKm:50000,stage:"DUE_SOON",
    },
  });
  assert.match(message.subject??"",/Oil change is due soon/);
  assert.match(message.body,/50,000 km/);
  assert.doesNotMatch(message.body,/estimate\//);
});

test("generic worker delivers maintenance intents without secure-link material",async()=>{
  const row=claimed({
    notificationType:"VEHICLE_MAINTENANCE_REMINDER",templateKey:"vehicle-maintenance-due-email-v1",
    deliverySecretId:null,expiresAt:null,deduplicationKey:"vehicle-maintenance:due:email",
    payload:{businessName:"KarKR Auto Care",branchName:"Main",branchPhone:null,branchEmail:"shop@example.com",
      customerName:"Juan",vehicleLabel:"Toyota Vios",plateNumber:null,serviceName:"Oil change",
      lastServiceAt:"2026-03-01T00:00:00.000Z",lastServiceOdometerKm:null,
      nextDueAt:"2026-09-01T00:00:00.000Z",nextDueOdometerKm:null,stage:"DUE"},
  });
  const repository=new MemoryRepository([row]);const email=new StubProvider();
  const summary=await processNotificationOutboxBatch({repository,providers:{email,sms:new StubProvider()},
    render:renderAutomotiveNotification("https://karkr.example"),workerId:"maintenance-worker"});
  assert.equal(summary.sent,1);assert.equal(email.calls.length,1);
});

test("worker records provider acceptance as sent and forwards deterministic idempotency",async()=>{
  const repository=new MemoryRepository([claimed()]);const email=new StubProvider();
  const summary=await processNotificationOutboxBatch({repository,providers:{email,sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-1",deliverySecretKey:encryptionKey});
  assert.deepEqual(summary,{claimed:1,sent:1,retried:0,failed:0,cancelled:0});
  assert.equal(email.calls.length,1);
  assert.equal(email.calls[0].idempotencyKey,claimed().deduplicationKey);
  assert.equal(repository.results[0].result,"sent");
});

test("worker cancels an opted-out channel before any provider attempt",async()=>{
  const repository=new MemoryRepository([claimed()],false);const email=new StubProvider();
  await processNotificationOutboxBatch({repository,providers:{email,sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-2",deliverySecretKey:encryptionKey});
  assert.equal(email.calls.length,0);
  assert.equal(repository.results[0].result,"cancelled");
  assert.equal(repository.results[0].errorCode,"EMAIL_OPTED_OUT");
});

test("worker treats a missing destination as terminal eligibility, not a provider retry",async()=>{
  const repository=new MemoryRepository([claimed({recipientAddress:null})]);const email=new StubProvider();
  const summary=await processNotificationOutboxBatch({repository,providers:{email,sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-missing-contact",deliverySecretKey:encryptionKey});
  assert.deepEqual(summary,{claimed:1,sent:0,retried:0,failed:0,cancelled:1});
  assert.equal(email.calls.length,0);
  assert.equal(repository.results[0].result,"cancelled");
  assert.equal(repository.results[0].errorCode,"EMAIL_MISSING");
  assert.equal(repository.results[0].nextAvailableAt,undefined);
});

test("worker does not send after a claimed row is cancelled by a concurrent domain decision",async()=>{
  const repository=new MemoryRepository([claimed()]);repository.isClaimActive=async()=>false;
  const email=new StubProvider();
  const summary=await processNotificationOutboxBatch({repository,providers:{email,sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-cancelled",deliverySecretKey:encryptionKey});
  assert.equal(email.calls.length,0);assert.equal(summary.cancelled,1);assert.equal(repository.results.length,0);
});

test("temporary provider failures use bounded backoff and permanent failures stop",async()=>{
  const now=new Date("2026-08-30T00:00:00.000Z");
  assert.equal(notificationRetryAt(1,now).toISOString(),"2026-08-30T00:01:00.000Z");
  assert.equal(notificationRetryAt(6,now).toISOString(),"2026-08-30T06:00:00.000Z");
  const retryRepository=new MemoryRepository([claimed()]);
  await processNotificationOutboxBatch({repository:retryRepository,
    providers:{email:new StubProvider(new DeliveryProviderError("RATE_LIMIT","Try later",true)),sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-3",deliverySecretKey:encryptionKey,now});
  assert.equal(retryRepository.results[0].result,"retry");
  assert.equal(retryRepository.results[0].nextAvailableAt,"2026-08-30T00:01:00.000Z");

  const failedRepository=new MemoryRepository([claimed({attemptCount:5})]);
  await processNotificationOutboxBatch({repository:failedRepository,
    providers:{email:new StubProvider(new DeliveryProviderError("INVALID_DESTINATION","Rejected",false)),sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-4",deliverySecretKey:encryptionKey,now});
  assert.equal(failedRepository.results[0].result,"failed");

  const exhaustedRepository=new MemoryRepository([claimed({attemptCount:5})]);
  await processNotificationOutboxBatch({repository:exhaustedRepository,
    providers:{email:new StubProvider(new DeliveryProviderError("RATE_LIMIT","Still unavailable",true)),sms:new StubProvider()},
    render:renderEstimateApprovalNotification("https://karkr.example"),workerId:"worker-5",deliverySecretKey:encryptionKey,now});
  assert.equal(exhaustedRepository.results[0].result,"failed");
});

test("provider selection never reports console delivery in production",()=>{
  assert.equal(createDeliveryProviders({emailProvider:"console",smsProvider:"console",nodeEnvironment:"test"}).email.configured,true);
  const production=createDeliveryProviders({emailProvider:"console",smsProvider:"console",nodeEnvironment:"production"});
  assert.equal(production.email.configured,false);assert.equal(production.sms.configured,false);
});

test("notification cron authentication requires the configured bearer secret",()=>{
  const secret="notification-secret-at-least-24";
  assert.equal(isAuthorizedNotificationCron(new Request("https://example.test"),secret),false);
  assert.equal(isAuthorizedNotificationCron(new Request("https://example.test",{headers:{authorization:"Bearer wrong"}}),secret),false);
  assert.equal(isAuthorizedNotificationCron(new Request("https://example.test",{headers:{authorization:`Bearer ${secret}`}}),secret),true);
  assert.equal(isAuthorizedNotificationCron(new Request("https://example.test"),undefined),false);
});
