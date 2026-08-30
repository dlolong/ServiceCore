export const industryKeys = ["automotive", "beauty", "hospitality", "field_service"] as const;
export type IndustryKey = (typeof industryKeys)[number];

export const industryFeatureKeys = [
  "vehicles",
  "appointments",
  "job_orders",
  "inventory",
  "payments",
  "commissions",
  "reservations",
] as const;
export type IndustryFeatureKey = (typeof industryFeatureKeys)[number];

export type IndustryConfig = {
  key: IndustryKey;
  productName: string;
  terminology: {
    customer: string;
    staff: string;
    booking: string;
    location: string;
  };
  features: Readonly<Record<IndustryFeatureKey, boolean>>;
};

export const karkrAutomotiveConfig: IndustryConfig = {
  key: "automotive",
  productName: "KarKR",
  terminology: {
    customer: "Customer",
    staff: "Staff",
    booking: "Appointment",
    location: "Branch",
  },
  features: {
    vehicles: true,
    appointments: true,
    job_orders: true,
    inventory: true,
    payments: true,
    commissions: false,
    reservations: false,
  },
};

export function industrySupportsFeature(config: IndustryConfig, feature: IndustryFeatureKey) {
  return config.features[feature];
}
