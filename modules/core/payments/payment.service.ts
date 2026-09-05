import { z } from "zod";

export const paymentMethods=["cash","gcash","maya","bank_transfer","card","other"] as const;
export const recordPaymentInputSchema=z.object({appointmentId:z.uuid(),amountCentavos:z.number().int().positive(),method:z.enum(paymentMethods),idempotencyKey:z.uuid(),reference:z.string().trim().max(100).nullable(),notes:z.string().trim().max(1000).nullable()});
export type PaymentRow={amountCentavos:number;status:string};
export function calculateAppointmentPaymentSummary(totalCentavos:number,payments:PaymentRow[]){
  const paidCentavos=payments.filter(({status})=>status==="paid").reduce((sum,{amountCentavos})=>sum+amountCentavos,0);
  const balanceCentavos=Math.max(0,totalCentavos-paidCentavos);
  return{totalCentavos,paidCentavos,balanceCentavos,status:balanceCentavos===0?"paid":paidCentavos>0?"partial":"unpaid" as "paid"|"partial"|"unpaid"};
}
