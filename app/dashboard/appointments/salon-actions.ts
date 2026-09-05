"use server";

import{revalidatePath}from"next/cache";
import{redirect}from"next/navigation";
import{z}from"zod";
import{getDashboardContext}from"@/lib/auth/context";
import{formValue,firstError}from"@/lib/crm";
import{parseMoneyToCentavos}from"@/lib/operations";
import{createClient}from"@/lib/supabase/server";
import{createAppointmentSelfServiceLink}from"@/modules/core/scheduling/appointment-self-service.runtime";
import{paymentMethods,recordPaymentInputSchema}from"@/modules/core/payments/payment.service";
import{isSalonVerticalTransition}from"@/modules/salon/appointments";

function go(id:string,kind:"message"|"error",message:string):never{redirect(`/dashboard/appointments/${id}?${kind}=${encodeURIComponent(message)}`)}
async function requireSalonOperator(){const context=await getDashboardContext();if(context.activeMembership.industry!=="salon"||!["owner","manager","advisor"].includes(context.activeMembership.role))throw new Error("Salon appointment access required.");return context;}

export async function transitionSalonAppointment(data:FormData){
  const id=formValue(data,"id"),action=formValue(data,"action");
  try{await requireSalonOperator();}catch(error){go(id,"error",error instanceof Error?error.message:"Unable to update appointment.");}
  if(!isSalonVerticalTransition(action))go(id,"error","That appointment transition is not allowed.");const supabase=await createClient();const{error}=await supabase.rpc("transition_salon_appointment",{p_appointment_id:id,p_action:action});if(error)go(id,"error","That appointment transition is not allowed.");
  revalidatePath("/dashboard");go(id,"message","Appointment updated.");
}

export async function createSalonAppointmentLink(data:FormData){
  const id=formValue(data,"id");
  try{await requireSalonOperator();}catch(error){go(id,"error",error instanceof Error?error.message:"Unable to create the customer link.");}
  const expiresAt=new Date(Date.now()+14*86_400_000).toISOString();let result;try{result=await createAppointmentSelfServiceLink({appointmentId:id,expiresAt});}catch(error){go(id,"error",error instanceof Error?error.message:"Unable to create the customer link.");}
  const path=`/appointment/${result.token}`;redirect(`/dashboard/appointments/${id}?message=${encodeURIComponent(result.deliveryEnabled?"Customer link created and reminders enabled.":"Customer link created. Delivery encryption is not configured; copy it manually.")}&customerLink=${encodeURIComponent(path)}`);
}

const paymentFormSchema=z.object({appointmentId:z.uuid(),amount:z.string().trim().min(1),method:z.enum(paymentMethods),idempotencyKey:z.uuid(),reference:z.string().trim().max(100),notes:z.string().trim().max(1000)});
export async function recordSalonAppointmentPayment(data:FormData){
  const id=formValue(data,"appointmentId"),parsed=paymentFormSchema.safeParse(Object.fromEntries(["appointmentId","amount","method","idempotencyKey","reference","notes"].map(key=>[key,formValue(data,key)])));
  if(!parsed.success)go(id,"error",firstError(parsed.error));
  const amount=parseMoneyToCentavos(parsed.data.amount);if(amount===null||amount<=0n||amount>100_000_000_000n)go(id,"error","Enter a valid payment amount with at most two decimals.");
  const{activeMembership}=await getDashboardContext();if(activeMembership.industry!=="salon"||!["owner","manager","cashier"].includes(activeMembership.role))go(id,"error","Payment access required.");let validated;try{validated=recordPaymentInputSchema.parse({appointmentId:id,amountCentavos:Number(amount),method:parsed.data.method,idempotencyKey:parsed.data.idempotencyKey,reference:parsed.data.reference||null,notes:parsed.data.notes||null});}catch(error){go(id,"error",error instanceof Error?error.message:"Unable to record payment.");}const supabase=await createClient();const{error}=await supabase.rpc("record_appointment_payment",{p_appointment_id:validated.appointmentId,p_amount_centavos:validated.amountCentavos,p_method:validated.method,p_idempotency_key:validated.idempotencyKey,p_reference:validated.reference,p_notes:validated.notes});if(error)go(id,"error",error.message.includes("amount")?"The payment exceeds the current balance.":error.message.includes("Idempotency key conflicts")?"This payment submission conflicts with an earlier request. Refresh and try again.":"Unable to record payment.");
  revalidatePath(`/dashboard/appointments/${id}`);go(id,"message","Payment recorded.");
}
