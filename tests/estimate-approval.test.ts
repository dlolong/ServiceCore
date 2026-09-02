import assert from "node:assert/strict";
import test from "node:test";

import {
  createEstimateApprovalLink,
  createEstimateApprovalToken,
  ESTIMATE_APPROVAL_LINK_LIFETIME_DAYS,
  estimateApprovalExpiry,
  estimateApprovalTokenSchema,
  hashEstimateApprovalToken,
  parsePublicEstimateApproval,
  type EstimateApprovalLinkPersistence,
} from "../modules/automotive/work-execution/estimate-approval";
import { decryptDeliverySecret } from "../lib/notifications/delivery-secret";
import { privateEstimateResponseHeaders } from "../lib/private-route-security";

test("approval tokens use hash-only validation plus an encrypted short-lived delivery secret",async()=>{
  const token=createEstimateApprovalToken();
  assert.equal(estimateApprovalTokenSchema.safeParse(token).success,true);
  const tokenHash=hashEstimateApprovalToken(token);
  assert.match(tokenHash,/^[0-9a-f]{64}$/);
  assert.notEqual(tokenHash,token);

  let persisted:Parameters<EstimateApprovalLinkPersistence["create"]>[0]|undefined;
  const persistence:EstimateApprovalLinkPersistence={
    async create(input){persisted=input;return{linkId:"5a000000-0000-4000-8000-000000000001",expiresAt:input.expiresAt,delivery:{email:{status:"cancelled",reason:"DELIVERY_SECRET_UNAVAILABLE"},sms:{status:"cancelled",reason:"DELIVERY_SECRET_UNAVAILABLE"}}};},
    async revoke(){},
  };
  const encryptionKey=Buffer.alloc(32,9).toString("base64");
  const result=await createEstimateApprovalLink("4a000000-0000-4000-8000-000000000001",persistence,encryptionKey);
  assert.equal(persisted?.tokenHash,hashEstimateApprovalToken(result.token));
  assert.equal("token" in (persisted??{}),false);
  assert.equal(JSON.stringify(persisted?.deliverySecret).includes(result.token),false);
  assert.equal(decryptDeliverySecret(persisted!.deliverySecret!,encryptionKey),result.token);
  assert.equal(result.token.length,43);
});

test("approval links use the named seven-day lifetime",()=>{
  const now=new Date("2026-08-30T00:00:00.000Z");
  assert.equal(ESTIMATE_APPROVAL_LINK_LIFETIME_DAYS,7);
  assert.equal(estimateApprovalExpiry(now).toISOString(),"2026-09-06T00:00:00.000Z");
});

test("public estimate DTO strips internal identifiers and private fields",()=>{
  const parsed=parsePublicEstimateApproval({
    state:"active",expiresAt:"2026-09-06T00:00:00.000Z",decidedAt:null,
    business:{name:"KarKR Auto Care",phone:"09171234567",organizationId:"private"},
    branch:{name:"Main",phone:null,email:null,address:["Makati",null,"Metro Manila"],internalNotes:"private"},
    job:{reference:"JO-2026-000001",customerId:"private",vehicle:{make:"Toyota",model:"Vios",modelYear:2024,plateNumber:"ABC123",vin:"private"}},
    estimate:{version:2,subtotalCentavos:100000,discountCentavos:0,taxCentavos:0,totalCentavos:100000,notes:"internal",items:[{id:"6a000000-0000-4000-8000-000000000001",description:"Brake service",quantity:1,unitPriceCentavos:100000,discountCentavos:0,lineTotalCentavos:100000,inventoryItemId:"private"}]},
  });
  const serialized=JSON.stringify(parsed);
  assert.equal(serialized.includes("organizationId"),false);
  assert.equal(serialized.includes("customerId"),false);
  assert.equal(serialized.includes("internalNotes"),false);
  assert.equal(serialized.includes("vin"),false);
  assert.equal(serialized.includes("inventoryItemId"),false);
  assert.equal("estimate" in parsed&&"id" in parsed.estimate.items[0],false);
});

test("public estimate boundary accepts controlled inactive states only",()=>{
  assert.deepEqual(parsePublicEstimateApproval({state:"expired",privateData:"hidden"}),{state:"expired"});
  assert.throws(()=>parsePublicEstimateApproval({state:"active",estimate:{}}),/cannot be displayed/i);
});

test("private estimate pages are no-store and no-index",()=>{
  assert.deepEqual(privateEstimateResponseHeaders("/estimate/private-token"),{
    "Cache-Control":"private, no-store, max-age=0",
    Pragma:"no-cache",
    "X-Robots-Tag":"noindex, nofollow, noarchive",
  });
  assert.equal(privateEstimateResponseHeaders("/shop/public-shop"),null);
});
