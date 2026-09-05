import { z } from "zod";
export const inspectionSchema=z.object({jobId:z.uuid(),odometerIn:z.union([z.literal(""),z.coerce.number().int().min(0).max(9_999_999)]),fuelLevel:z.union([z.literal(""),z.coerce.number().int().min(0).max(100)]),exteriorNotes:z.string().trim().max(2000),interiorNotes:z.string().trim().max(2000),tireNotes:z.string().trim().max(2000),lightNotes:z.string().trim().max(2000),windshieldNotes:z.string().trim().max(2000),damageNotes:z.string().trim().max(2000),warningNotes:z.string().trim().max(2000),belongingsNote:z.string().trim().max(2000)});
export const estimateSchema=z.object({jobId:z.uuid(),discount:z.string(),tax:z.string(),notes:z.string().trim().max(2000)});
export const paymentSchema=z.object({invoiceId:z.uuid(),amount:z.string(),method:z.enum(["cash","gcash","maya","bank_transfer","card","other"]),reference:z.string().trim().max(200),notes:z.string().trim().max(1000)});
export const assignmentSchema=z.object({jobId:z.uuid(),staffId:z.union([z.literal(""),z.uuid()]).transform(value=>value||null),promisedAt:z.string()});
export const additionalWorkSchema=z.object({jobId:z.uuid(),serviceId:z.uuid(),quantity:z.coerce.number().int().min(1).max(100),requiresApproval:z.boolean(),notes:z.string().trim().max(1000)});
export const reversalSchema=z.object({paymentId:z.uuid(),action:z.enum(["refund","void"]),note:z.string().trim().min(2).max(1000)});
export function jobNumber(value:number|string,year=new Date().getFullYear()){return `JOB-${year}-${String(value).padStart(6,"0")}`;}
