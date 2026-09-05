import assert from "node:assert/strict";
import{readFileSync}from"node:fs";
import test from"node:test";
import{calculateAppointmentPaymentSummary,recordPaymentInputSchema}from"../modules/core/payments/payment.service";
import{createAppointmentSelfServiceToken,hashAppointmentSelfServiceToken,publicAppointmentBalance}from"../modules/core/scheduling/appointment-self-service";
import{renderSalonAppointmentReminder}from"../modules/salon/notifications/appointment-reminder.templates";
import{salonAppointmentActions}from"../modules/salon/appointments";

test("Salon lifecycle is centralized and requires in-service before completion",()=>{
  assert.deepEqual(salonAppointmentActions("checked_in"),["start_service","cancel"]);
  assert.deepEqual(salonAppointmentActions("in_service"),["complete"]);
  assert.deepEqual(salonAppointmentActions("completed"),[]);
});

test("appointment self-service tokens are random-looking and stored by hash",()=>{
  const first=createAppointmentSelfServiceToken(),second=createAppointmentSelfServiceToken();
  assert.match(first,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(first,second);
  assert.match(hashAppointmentSelfServiceToken(first),/^[0-9a-f]{64}$/);assert.doesNotMatch(hashAppointmentSelfServiceToken(first),new RegExp(first));
});

test("appointment payment summary ignores failed and reversed payments",()=>{
  assert.deepEqual(calculateAppointmentPaymentSummary(100_000,[{amountCentavos:25_000,status:"paid"},{amountCentavos:50_000,status:"failed"},{amountCentavos:10_000,status:"refunded"}]),{totalCentavos:100_000,paidCentavos:25_000,balanceCentavos:75_000,status:"partial"});
  assert.equal(publicAppointmentBalance({totalCentavos:45_000,paidCentavos:45_000}),0);
});

test("appointment payment input requires a stable caller idempotency key",()=>{
  const input={appointmentId:"5b900000-0000-4000-8000-000000000001",amountCentavos:20000,method:"cash" as const,idempotencyKey:"5b910000-0000-4000-8000-000000000001",reference:null,notes:null};
  assert.equal(recordPaymentInputSchema.safeParse(input).success,true);
  assert.equal(recordPaymentInputSchema.safeParse({...input,idempotencyKey:"new-on-every-submit"}).success,false);
});

test("Salon appointment reminder templates are vertical-owned and vehicle-free",()=>{
  const render=renderSalonAppointmentReminder("https://example.test");
  const email=render({templateKey:"salon-appointment-reminder-email-v1",deliverySecret:"secret-token",payload:{businessName:"Luna Beauty",branchName:"BGC",clientFirstName:"Ana",startsAt:"2026-09-04T02:00:00.000Z",timezone:"Asia/Manila",treatments:["Haircut"],staffNames:["Alex Stylist"]}});
  assert.match(email.body,/Confirm or reschedule securely/);assert.match(email.body,/with Alex Stylist/);assert.match(email.body,/\/appointment\/secret-token/);assert.doesNotMatch(email.body,/vehicle|job order|service bay/i);
  assert.doesNotThrow(()=>render({templateKey:"salon-appointment-reminder-email-v1",deliverySecret:"legacy-token",payload:{businessName:"Luna Beauty",branchName:"BGC",clientFirstName:"Ana",startsAt:"2026-09-04T02:00:00.000Z",timezone:"Asia/Manila",treatments:["Haircut"]}}));
});

test("Salon operations use shared boundaries without Automotive runtime imports",()=>{
  for(const file of ["modules/core/scheduling/appointment-self-service.ts","modules/core/scheduling/appointment-self-service.runtime.ts","modules/core/payments/payment.service.ts","modules/salon/appointments.ts","app/appointment/[token]/page.tsx"]){const source=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");assert.doesNotMatch(source,/modules\/automotive/,file);}
  const migration=readFileSync(new URL("../supabase/migrations/0043_salon_appointment_operations.sql",import.meta.url),"utf8");
  const hardening=readFileSync(new URL("../supabase/migrations/0045_salon_appointment_operation_hardening.sql",import.meta.url),"utf8");
  const detailInvalidation=readFileSync(new URL("../supabase/migrations/0046_appointment_reminder_detail_invalidation.sql",import.meta.url),"utf8");
  const transactionalComparison=readFileSync(new URL("../supabase/migrations/0047_transactional_reminder_detail_comparison.sql",import.meta.url),"utf8");
  assert.match(migration,/transition_salon_appointment/);assert.match(migration,/Payment\/appointment tenant mismatch/);
  assert.match(hardening,/appointment_idempotency_key/);assert.match(hardening,/schedule_revision/);assert.match(hardening,/assignedStaff/);assert.match(hardening,/revoke insert,update on table public\.appointments/);
  assert.match(detailInvalidation,/appointment_staff_reminder_generation/);assert.match(detailInvalidation,/appointment_treatment_reminder_generation/);assert.match(detailInvalidation,/APPOINTMENT_STAFF_CHANGED/);assert.match(detailInvalidation,/APPOINTMENT_TREATMENTS_CHANGED/);
  assert.match(transactionalComparison,/old_staff is distinct from new_staff/);assert.match(transactionalComparison,/old_treatments is distinct from new_treatments/);assert.match(transactionalComparison,/suppress_appointment_detail_invalidation/);assert.match(transactionalComparison,/APPOINTMENT_DETAILS_CHANGED/);
  const runtime=readFileSync(new URL("../modules/core/scheduling/appointment-self-service.runtime.ts",import.meta.url),"utf8");assert.match(runtime,/rescheduleAuthorizedAppointment/);assert.match(runtime,/availabilityDependenciesForClient/);
  const actions=readFileSync(new URL("../app/dashboard/operations-actions.ts",import.meta.url),"utf8");assert.match(actions,/createAppointmentSelfServiceLink/);
});
