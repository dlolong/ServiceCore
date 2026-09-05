import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const appointmentSelfServiceTokenSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export function createAppointmentSelfServiceToken(){return randomBytes(32).toString("base64url");}
export function hashAppointmentSelfServiceToken(token:string){return createHash("sha256").update(appointmentSelfServiceTokenSchema.parse(token)).digest("hex");}

const publicAppointmentSchema=z.discriminatedUnion("state",[
  z.object({state:z.literal("active"),businessName:z.string(),branchName:z.string(),branchTimezone:z.string(),appointmentStatus:z.string(),startsAt:z.string(),endsAt:z.string().nullable(),treatments:z.array(z.object({name:z.string(),durationMinutes:z.number()})),assignedStaff:z.array(z.string()),paymentStatus:z.enum(["unpaid","partial","paid"]),totalCentavos:z.number(),paidCentavos:z.number()}),
  z.object({state:z.enum(["invalid","expired","revoked","unavailable"])}),
]);
export type PublicAppointmentSelfService=z.infer<typeof publicAppointmentSchema>;
export function parsePublicAppointmentSelfService(value:unknown):PublicAppointmentSelfService{return publicAppointmentSchema.parse(value);}

export function publicAppointmentBalance(input:{totalCentavos:number;paidCentavos:number}){
  return Math.max(0,input.totalCentavos-input.paidCentavos);
}
