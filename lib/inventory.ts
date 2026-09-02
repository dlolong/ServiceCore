import { z } from "zod";

const money = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, "Enter a valid PHP amount.");
export const inventoryItemSchema = z.object({
  name:z.string().trim().min(2).max(120),sku:z.string().trim().max(60),category:z.string().trim().max(80),description:z.string().trim().max(1000),unit:z.string().trim().min(1).max(30),
  cost:money,sellPrice:money,reorderLevel:z.coerce.number().min(0).max(999999999),lotNumber:z.string().trim().max(80),expiresOn:z.string(),
});
export const movementSchema=z.object({itemId:z.uuid(),type:z.enum(["opening","purchase","usage","adjustment","return","waste"]),quantity:z.coerce.number().positive().max(999999999),note:z.string().trim().max(500),idempotencyKey:z.uuid()});
export const transferSchema=z.object({sourceItemId:z.uuid(),targetItemId:z.uuid(),quantity:z.coerce.number().positive().max(999999999),note:z.string().trim().max(500),idempotencyKey:z.uuid()});
export const recipeSchema=z.object({serviceId:z.uuid(),inventoryItemId:z.uuid(),quantity:z.coerce.number().positive().max(999999)});
export const maintenanceRuleSchema=z.object({serviceId:z.uuid(),intervalMonths:z.union([z.literal(""),z.coerce.number().int().min(1).max(120)]),intervalKm:z.union([z.literal(""),z.coerce.number().int().min(100).max(500000)]),leadDays:z.coerce.number().int().min(0).max(365)}).refine(v=>v.intervalMonths!==""||v.intervalKm!=="",{message:"Set a month or kilometer interval."});
export const maintenanceDismissalSchema=z.object({id:z.uuid(),reason:z.string().trim().min(1,"Enter a dismissal reason.").max(500)});
export const maintenanceSnoozeSchema=z.object({id:z.uuid(),snoozedUntil:z.iso.date(),reason:z.string().trim().max(500)});
export const maintenanceActionSchema=z.object({id:z.uuid()});
export const preferenceSchema=z.object({customerId:z.uuid(),emailOptIn:z.boolean(),smsOptIn:z.boolean()});
export function quantityLabel(value:number|string,unit:string){return `${Number(value).toLocaleString("en-PH",{maximumFractionDigits:3})} ${unit}`;}
