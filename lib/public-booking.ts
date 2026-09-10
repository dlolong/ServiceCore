import{z}from"zod";
export type PublicBranch={id:string;name:string;timezone:string;description:string|null;phone:string|null;email:string|null;address:(string|null)[];mapUrl:string|null;hours:Record<string,{open?:string;close?:string;closed?:boolean}>;acceptsBookings:boolean};
export type PublicService={id:string;name:string;description:string|null;durationMinutes:number;priceCentavos:number;category:string|null};
export type PublicShop={industry:"automotive"|"salon";slug:string;name:string;description:string|null;logoUrl:string|null;coverUrl:string|null;phone:string|null;email:string|null;website:string|null;facebook:string|null;instagram:string|null;branches:PublicBranch[];services:PublicService[];gallery:{url:string;alt:string}[]};
export const publicBookingSchema=z.object({slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),branchId:z.uuid(),serviceIds:z.array(z.uuid()).min(1).max(10),preferredAt:z.iso.datetime({offset:true}),customerName:z.string().trim().min(2).max(120),phone:z.string().trim().min(7).max(30),email:z.union([z.literal(""),z.email().max(254)]),vehicleMake:z.string().trim().min(1).max(80),vehicleModel:z.string().trim().min(1).max(80),vehicleYear:z.union([z.literal(""),z.coerce.number().int().min(1900).max(new Date().getFullYear()+1)]),vehicleType:z.string().trim().max(80),plateNumber:z.string().trim().max(30),customerNote:z.string().trim().max(1000),website:z.string().max(0)});

// The caller must obtain this industry from get_public_shop, never from form input.
export function publicBookingSchemaForIndustry(industry: PublicShop["industry"]) {
  if (industry === "automotive") return publicBookingSchema;
  return publicBookingSchema.extend({
    vehicleMake: z.string().optional().transform(() => ""),
    vehicleModel: z.string().optional().transform(() => ""),
    vehicleYear: z.union([z.string(), z.number()]).optional().transform(() => "" as const),
    vehicleType: z.string().optional().transform(() => ""),
    plateNumber: z.string().optional().transform(() => ""),
  });
}

export function publicBookingDate(value: unknown, timezone: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 60);
  const maxDate = max.toISOString().slice(0, 10);
  const valid = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
    && value >= today && value <= maxDate;
  return { date: valid ? value : today, today, maxDate };
}
export type PublicBookingState = { error?: string; values?: Record<string, string> };

const httpUrl=z.url().max(1000).refine(value=>value.startsWith("https://")||value.startsWith("http://"),"Use an HTTP or HTTPS URL.");
export const publicPageSchema=z.object({description:z.string().trim().max(2000),logoUrl:z.union([z.literal(""),httpUrl]),coverUrl:z.union([z.literal(""),httpUrl]),instagramUrl:z.union([z.literal(""),httpUrl]),facebookPage:z.union([z.literal(""),httpUrl]),website:z.union([z.literal(""),httpUrl]),enabled:z.boolean()});
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const openingDay = z.union([
  z.object({ closed: z.literal(true), open: clockTime.optional(), close: clockTime.optional() }).strict(),
  z.object({ closed: z.literal(false).optional(), open: clockTime, close: clockTime }).strict().refine(day => day.open < day.close, "Closing time must be after opening time."),
]);
const openingHours = z.object({ monday: openingDay.optional(), tuesday: openingDay.optional(), wednesday: openingDay.optional(), thursday: openingDay.optional(), friday: openingDay.optional(), saturday: openingDay.optional(), sunday: openingDay.optional() }).strict();
export const branchPublicSchema = z.object({
  branchId: z.uuid(), description: z.string().trim().max(1000), mapUrl: z.union([z.literal(""), httpUrl]), acceptsBookings: z.boolean(),
  openingHours: z.string().max(5000).transform((value, ctx) => {
    try { return JSON.parse(value) as unknown; } catch { ctx.addIssue({ code: "custom", message: "Opening hours must be valid JSON." }); return z.NEVER; }
  }).pipe(openingHours),
});
export const publicServiceSchema = z.object({ serviceId: z.uuid(), isPublic: z.enum(["true", "false"]).transform(value => value === "true") });
export const publicGallerySchema = z.object({ url: httpUrl, alt: z.string().trim().min(2).max(200) });
