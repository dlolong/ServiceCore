import assert from "node:assert/strict";
import test from "node:test";

import {
  consumeJobOrderPart,
  releaseJobOrderPart,
  reserveJobOrderPart,
  reserveRequiredJobOrderParts,
  type AutomotiveJobPartsPersistence,
} from "../modules/automotive/work-execution/job-parts.service";
import { reserveInventory, type CoreInventoryReservationPersistence } from "../modules/core/inventory/inventory-reservation.service";

const jobOrderId="99400000-0000-4000-8000-000000000001";
const inventoryItemId="a9400000-0000-4000-8000-000000000001";
const reservationId="d9400000-0000-4000-8000-000000000001";

function persistence(calls:string[]):AutomotiveJobPartsPersistence{
  return{
    async reserve(input){calls.push(`reserve:${input.referenceType}:${input.quantity}:${input.idempotencyKey}`);return reservationId;},
    async consume(input){calls.push(`consume:${input.quantity}:${input.idempotencyKey}`);return "e9400000-0000-4000-8000-000000000001";},
    async release(input){calls.push(`release:${input.quantity}:${input.idempotencyKey}`);return "f9400000-0000-4000-8000-000000000001";},
    async reserveAllRequired(id,key){calls.push(`all:${id}:${key}`);return 1;},
  };
}

test("Core Inventory accepts external references without Automotive concepts",async()=>{
  const calls:string[]=[];
  const corePersistence:CoreInventoryReservationPersistence=persistence(calls);
  const result=await reserveInventory({inventoryItemId,referenceType:"service_visit",referenceId:jobOrderId,quantity:1.25,idempotencyKey:"core-reserve-1"},corePersistence);
  assert.equal(result,reservationId);
  assert.deepEqual(calls,["reserve:service_visit:1.25:core-reserve-1"]);
});

test("Automotive parts adapter composes reserve consume release and reserve-all through Core",async()=>{
  const calls:string[]=[],adapter=persistence(calls);
  await reserveJobOrderPart({jobOrderId,inventoryItemId,quantity:2,idempotencyKey:"reserve-1"},adapter);
  await consumeJobOrderPart({jobOrderId,reservationId,quantity:1.5,idempotencyKey:"consume-1"},adapter);
  await releaseJobOrderPart({jobOrderId,reservationId,quantity:.5,idempotencyKey:"release-1"},adapter);
  await reserveRequiredJobOrderParts({jobOrderId,idempotencyKey:"all-1"},adapter);
  assert.deepEqual(calls,["reserve:job_order:2:reserve-1","consume:1.5:consume-1","release:0.5:release-1",`all:${jobOrderId}:all-1`]);
});

test("reservation quantities reject precision beyond the numeric ledger",async()=>{
  const adapter=persistence([]);
  await assert.rejects(()=>reserveJobOrderPart({jobOrderId,inventoryItemId,quantity:1.0001,idempotencyKey:"precision"},adapter),/multiple of 0.001/);
  await assert.rejects(()=>consumeJobOrderPart({jobOrderId,reservationId,quantity:0,idempotencyKey:"zero"},adapter),/>0|greater than 0/);
});
