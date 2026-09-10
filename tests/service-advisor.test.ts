import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateEstimateLineTotalCentavos, calculateEstimateTotals, calculatePaymentSummary, evaluateJobOrderWorkReadiness, evaluatePartsReadiness, evaluateVehicleReleaseReadiness, getRecommendedJobOrderAction } from "../modules/automotive/work-execution/service-advisor";

test("estimate totals use integer centavos for service and part lines",()=>{
  assert.equal(calculateEstimateLineTotalCentavos({quantity:2,unitPriceCentavos:50000,discountCentavos:10000}),90000);
  assert.deepEqual(calculateEstimateTotals([{quantity:1,unitPriceCentavos:150000,discountCentavos:0},{quantity:2,unitPriceCentavos:50000,discountCentavos:10000}],20000,5000),{subtotalCentavos:240000,discountCentavos:20000,taxCentavos:5000,totalCentavos:225000});
});

test("parts readiness distinguishes none, partial, and ready",()=>{
  assert.equal(evaluatePartsReadiness([]).status,"NOT_REQUIRED");
  assert.deepEqual(evaluatePartsReadiness([{inventoryItemId:"a",name:"Filter",requiredQuantity:1,reservedQuantity:1,consumedQuantity:0,availableQuantity:2},{inventoryItemId:"b",name:"Pads",requiredQuantity:1,reservedQuantity:0,consumedQuantity:0,availableQuantity:0}]).status,"PARTIAL");
  assert.equal(evaluatePartsReadiness([{inventoryItemId:"a",name:"Filter",requiredQuantity:1,reservedQuantity:1,consumedQuantity:0,availableQuantity:0}]).status,"READY");
});

test("work readiness keeps authorization and parts as independent blockers",()=>{
  assert.deepEqual(evaluateJobOrderWorkReadiness({status:"approved",inspectionComplete:true,estimateStatus:"approved",authorizationCurrent:false,partsStatus:"READY"}).blockers,["CUSTOMER_AUTHORIZATION_REQUIRED"]);
  assert.deepEqual(evaluateJobOrderWorkReadiness({status:"approved",inspectionComplete:true,estimateStatus:"approved",authorizationCurrent:true,partsStatus:"NOT_READY"}).blockers,["PARTS_NOT_READY"]);
  assert.equal(evaluateJobOrderWorkReadiness({status:"approved",inspectionComplete:true,estimateStatus:"approved",authorizationCurrent:true,partsStatus:"READY"}).ready,true);
});

test("payment summary ignores failed and void payments",()=>{
  assert.deepEqual(calculatePaymentSummary(100000,[{amountCentavos:25000,status:"paid"},{amountCentavos:50000,status:"failed"},{amountCentavos:10000,status:"voided"}]),{totalCentavos:100000,paidCentavos:25000,balanceCentavos:75000});
});

test("release requires QC status, current authorization, and zero balance",()=>{
  assert.equal(evaluateVehicleReleaseReadiness({status:"ready_for_release",authorizationCurrent:true,balanceCentavos:0}).ready,true);
  assert.deepEqual(evaluateVehicleReleaseReadiness({status:"in_progress",authorizationCurrent:true,balanceCentavos:5000}).blockers,["QC_NOT_COMPLETE","BALANCE_REMAINING"]);
});

test("recommended action follows advisor workflow",()=>{
  assert.equal(getRecommendedJobOrderAction({status:"queued",hasEstimate:false,authorizationCurrent:false,partsStatus:"NOT_REQUIRED",balanceCentavos:0}),"PREPARE_ESTIMATE");
  assert.equal(getRecommendedJobOrderAction({status:"approved",hasEstimate:true,authorizationCurrent:true,partsStatus:"READY",balanceCentavos:0}),"START_WORK");
  assert.equal(getRecommendedJobOrderAction({status:"ready_for_release",hasEstimate:true,authorizationCurrent:true,partsStatus:"READY",balanceCentavos:5000}),"RECORD_PAYMENT");
});

test("Job Order photo upload lets React configure the server-action form encoding",()=>{
  const page=readFileSync("app/dashboard/jobs/[jobId]/page.tsx","utf8");
  const photoForm=page.match(/<form action=\{uploadJobPhoto\}[^>]*>/)?.[0];
  assert.ok(photoForm,"Expected the Job Order photo upload form.");
  assert.doesNotMatch(photoForm,/\b(?:encType|method)=/);
});
