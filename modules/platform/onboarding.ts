import type { PublicProductKey } from "@/modules/platform/product-entry";
import { verticalBrands } from "@/modules/platform/brand";

export const onboardingSignalKeys = ["branch", "services", "staff", "resources", "customers", "vehicles", "appointments"] as const;
export type OnboardingSignalKey = (typeof onboardingSignalKeys)[number];

export type OnboardingStepConfig = {
  key: OnboardingSignalKey;
  label: string;
  description: string;
  href: string;
};

export type VerticalOnboardingConfig = {
  title: string;
  description: string;
  steps: readonly OnboardingStepConfig[];
};

export const automotiveOnboarding: VerticalOnboardingConfig = {
  title: `Welcome to ${verticalBrands.automotive.displayName}`,
  description: "Finish the essentials for your automotive team. You can use the app while setup is in progress.",
  steps: [
    { key: "branch", label: "Add Branch", description: "Set your operating location and timezone.", href: "/dashboard/settings/branches" },
    { key: "services", label: "Add Services", description: "Add the automotive services you sell.", href: "/dashboard/services" },
    { key: "staff", label: "Add Staff", description: "Invite advisors and technicians.", href: "/dashboard/settings/staff" },
    { key: "resources", label: "Add Service Bays", description: "Set the bays used for scheduling.", href: "/dashboard/settings/resources" },
    { key: "customers", label: "Add Customer", description: "Create your first customer record.", href: "/dashboard/customers" },
    { key: "vehicles", label: "Add Vehicle", description: "Connect a vehicle to a customer.", href: "/dashboard/vehicles" },
    { key: "appointments", label: "Create Appointment", description: "Book the first service visit.", href: "/dashboard/appointments/new" },
  ],
};

export const salonOnboarding: VerticalOnboardingConfig = {
  title: `Welcome to ${verticalBrands.salon.displayName}`,
  description: "Finish the essentials for your team. You can use the app while setup is in progress.",
  steps: [
    { key: "branch", label: "Add Branch", description: "Set your salon location and timezone.", href: "/dashboard/settings/branches" },
    { key: "services", label: "Add Treatments", description: "Add the treatments your salon offers.", href: "/dashboard/services" },
    { key: "staff", label: "Add Staff", description: "Invite stylists, therapists, and front-desk staff.", href: "/dashboard/settings/staff" },
    { key: "resources", label: "Add Chairs / Rooms", description: "Set resources used for appointments.", href: "/dashboard/settings/resources" },
    { key: "customers", label: "Add Client", description: "Create your first Client record.", href: "/dashboard/customers" },
    { key: "appointments", label: "Create Appointment", description: "Book your first Client appointment.", href: "/dashboard/appointments/new" },
  ],
};

export const onboardingByIndustry: Record<PublicProductKey, VerticalOnboardingConfig> = {
  automotive: automotiveOnboarding,
  salon: salonOnboarding,
};

export function onboardingForIndustry(industry: PublicProductKey) {
  return onboardingByIndustry[industry];
}

export function calculateOnboardingProgress(config: VerticalOnboardingConfig, signals: Record<OnboardingSignalKey, boolean>) {
  const completed = config.steps.filter(({ key }) => signals[key]).length;
  return { completed, total: config.steps.length, percentage: Math.round((completed / config.steps.length) * 100) };
}
