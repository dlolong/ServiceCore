import { z } from "zod";

export function formatMoney(centavos: number | bigint, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(Number(centavos) / 100);
}

export function parseMoneyToCentavos(value: string) {
  const normalized = value.trim().replace(/[,₱\s]/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60); const remainder = minutes % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ""}`;
}

export function queueLabel(source: "appointment" | "walk_in", number: number) {
  return `${source === "appointment" ? "A" : "W"}-${String(number).padStart(3, "0")}`;
}

export function canTransitionAppointment(status: string, action: string) {
  return (action === "confirm" && status === "requested") ||
    (action === "arrive" && ["requested", "confirmed"].includes(status)) ||
    (action === "complete" && status === "checked_in") ||
    (["cancel", "no_show"].includes(action) && ["requested", "confirmed"].includes(status));
}

export function zonedDateTimeToUtc(localDateTime: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) return null;
  const desired = new Date(`${localDateTime}:00Z`);
  if (Number.isNaN(desired.valueOf())) return null;
  let result = desired;
  for (let pass = 0; pass < 2; pass++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(result);
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const represented = new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:00Z`);
    result = new Date(result.valueOf() + desired.valueOf() - represented.valueOf());
  }
  return result;
}

export function inputDateTimeInZone(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const categorySchema = z.object({ name: z.string().trim().min(2).max(100), sortOrder: z.coerce.number().int().min(0).max(9999) });
export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(160), categoryId: z.union([z.literal(""), z.uuid()]).transform((value) => value || null),
  description: optional(2000), shortDescription: optional(300), code: optional(50),
  durationMinutes: z.coerce.number().int().min(1).max(10080), basePrice: z.string(), isAddOn: z.boolean(), parentServiceId: z.union([z.literal(""), z.uuid()]).transform((value) => value || null),
});
export const walkInSchema = z.object({ branchId: z.uuid(), customerId: z.uuid(), vehicleId: z.uuid(), serviceIds: z.array(z.uuid()).min(1), notes: optional(1000) });

export function selectedValues(data: FormData, key: string) { return data.getAll(key).filter((value): value is string => typeof value === "string"); }
