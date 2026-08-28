import assert from"node:assert/strict";import test from"node:test";import{jobNumber,paymentSchema}from"../lib/jobs";
test("formats stable human-readable job numbers",()=>assert.equal(jobNumber(123,2026),"JOB-2026-000123"));
test("accepts supported manual Philippine payment methods",()=>{for(const method of["cash","gcash","maya","bank_transfer","card","other"])assert.equal(paymentSchema.safeParse({invoiceId:"10000000-0000-4000-8000-000000000001",amount:"100.00",method,reference:"",notes:""}).success,true)});
test("rejects unsupported payment methods",()=>assert.equal(paymentSchema.safeParse({invoiceId:"10000000-0000-4000-8000-000000000001",amount:"100",method:"automatic_gcash",reference:"",notes:""}).success,false));
