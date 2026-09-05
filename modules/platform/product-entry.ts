import type { IndustryKey } from "@/modules/platform/industry";
import { productBrand, supportedVerticalKeys, verticalBrands, type SupportedVerticalKey } from "@/modules/platform/brand";

export const publicProductKeys = supportedVerticalKeys;
export type PublicProductKey = SupportedVerticalKey;

export type BusinessTypeOption = {
  value: string;
  label: string;
};

export type ProductEntryConfig = {
  industry: PublicProductKey;
  productName: string;
  eyebrow: string;
  loginTitle: string;
  loginDescription: string;
  signupDescription: string;
  businessTypeLabel: string;
  businessTypes: readonly BusinessTypeOption[];
};

const productEntries: Record<PublicProductKey, ProductEntryConfig> = {
  automotive: {
    industry: "automotive",
    productName: verticalBrands.automotive.displayName,
    eyebrow: "Automotive",
    loginTitle: "Welcome back",
    loginDescription: "Sign in to manage your automotive business.",
    signupDescription: `Create your ${productBrand.name} account and set up your automotive business.`,
    businessTypeLabel: "Automotive",
    businessTypes: [
      { value: "car_wash", label: "Car Wash" },
      { value: "auto_detailing", label: "Auto Detailing" },
      { value: "car_wash_detailing", label: "Car Wash & Detailing" },
      { value: "auto_repair", label: "Auto Repair" },
      { value: "pms_maintenance", label: "PMS / Maintenance" },
      { value: "tire_shop", label: "Tire Shop" },
      { value: "battery_shop", label: "Battery Shop" },
      { value: "auto_aircon", label: "Auto Aircon" },
      { value: "ceramic_coating", label: "Ceramic Coating" },
      { value: "tint_ppf", label: "Tint / PPF" },
      { value: "full_auto_service", label: "Full Auto Service Center" },
      { value: "other", label: "Other Auto-care Service" },
    ],
  },
  salon: {
    industry: "salon",
    productName: verticalBrands.salon.displayName,
    eyebrow: "Salon & Beauty",
    loginTitle: "Welcome back",
    loginDescription: "Sign in to manage your salon or beauty business.",
    signupDescription: `Create your ${productBrand.name} account and set up your salon or beauty business.`,
    businessTypeLabel: "Salon & Beauty",
    businessTypes: [
      { value: "salon", label: "Salon" },
      { value: "spa", label: "Spa" },
      { value: "facial_clinic", label: "Facial / Skin Care" },
      { value: "nail_salon", label: "Nail Salon" },
      { value: "barber_shop", label: "Barber Shop" },
      { value: "other_beauty", label: "Other Beauty Service" },
    ],
  },
};

export function isPublicProductKey(value: unknown): value is PublicProductKey {
  return typeof value === "string" && publicProductKeys.includes(value as PublicProductKey);
}

export function resolveOptionalProductEntry(value: unknown): ProductEntryConfig | null {
  return isPublicProductKey(value) ? productEntries[value] : null;
}

export function resolveProductEntry(value: unknown): ProductEntryConfig {
  return resolveOptionalProductEntry(value) ?? productEntries.automotive;
}

export function resolveBusinessIndustry(businessType: string): PublicProductKey | null {
  for (const entry of Object.values(productEntries)) {
    if (entry.businessTypes.some(({ value }) => value === businessType)) return entry.industry;
  }
  return null;
}

export function isEnabledSignupIndustry(value: IndustryKey): value is PublicProductKey {
  return value === "automotive" || value === "salon";
}

export const productEntryConfigs = productEntries;
