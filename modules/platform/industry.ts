import { productBrand, verticalBrands } from "@/modules/platform/brand";

export const industryKeys = ["automotive", "salon", "hospitality", "field_service"] as const;
export type IndustryKey = (typeof industryKeys)[number];

export const industryFeatureKeys = [
  "vehicles",
  "appointments",
  "job_orders",
  "inventory",
  "payments",
  "commissions",
  "reservations",
  "queue",
  "maintenance",
  "booking_requests",
  "resources",
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
    service: string;
    resource: string;
    product: string;
  };
  features: Readonly<Record<IndustryFeatureKey, boolean>>;
};

export const karkrAutomotiveConfig: IndustryConfig = {
  key: "automotive",
  productName: verticalBrands.automotive.displayName,
  terminology: {
    customer: "Customer",
    staff: "Staff",
    booking: "Appointment",
    location: "Branch",
    service: "Service",
    resource: "Service bay",
    product: "Product",
  },
  features: {
    vehicles: true,
    appointments: true,
    job_orders: true,
    inventory: true,
    payments: true,
    commissions: false,
    reservations: false,
    queue: true,
    maintenance: true,
    booking_requests: true,
    resources: true,
  },
};

export const salonConfig: IndustryConfig = {
  key: "salon",
  productName: verticalBrands.salon.displayName,
  terminology: {
    customer: "Client",
    staff: "Staff",
    booking: "Appointment",
    location: "Branch",
    service: "Treatment",
    resource: "Station",
    product: "Product",
  },
  features: {
    vehicles: false,
    appointments: true,
    job_orders: false,
    inventory: true,
    payments: false,
    commissions: false,
    reservations: false,
    queue: false,
    maintenance: false,
    booking_requests: true,
    resources: true,
  },
};

const disabledIndustryConfig = (key: "hospitality" | "field_service"): IndustryConfig => ({
  ...salonConfig,
  key,
  productName: productBrand.name,
  features: Object.fromEntries(industryFeatureKeys.map((feature) => [feature, false])) as Record<IndustryFeatureKey, boolean>,
});

const industryConfigs: Record<IndustryKey, IndustryConfig> = {
  automotive: karkrAutomotiveConfig,
  salon: salonConfig,
  hospitality: disabledIndustryConfig("hospitality"),
  field_service: disabledIndustryConfig("field_service"),
};

export function resolveIndustryConfig(key: string | null | undefined): IndustryConfig {
  const config = industryConfigs[key as IndustryKey];
  if (!config) throw new Error("Unsupported organization industry.");
  return config;
}

export function industrySupportsFeature(config: IndustryConfig, feature: IndustryFeatureKey) {
  return config.features[feature];
}
