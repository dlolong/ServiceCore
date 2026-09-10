export type LaunchPlanId = "free" | "starter" | "business" | "pro" | "multi_branch";

export type LaunchPlan = {
  id: LaunchPlanId;
  name: string;
  monthlyPriceCentavos: number;
  yearlyPriceCentavos: number | null;
  custom: boolean;
  recommended?: boolean;
  summary: string;
  highlights: readonly string[];
};

/**
 * Customer-facing launch catalog shared by public Plans and authenticated Billing.
 * Keep the matching database plan rows and Stripe Prices synchronized with this file.
 */
export const launchPlanCatalog: readonly LaunchPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceCentavos: 0,
    yearlyPriceCentavos: 0,
    custom: false,
    summary: "Explore the essentials and prepare your first workflow.",
    highlights: ["1 branch", "2 staff", "Customers or Clients", "Services or Treatments", "Appointments"],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPriceCentavos: 49_900,
    yearlyPriceCentavos: 499_000,
    custom: false,
    summary: "For a small team ready to run daily work in one place.",
    highlights: ["1 branch", "5 staff", "Customers or Clients", "Services or Treatments", "Appointments"],
  },
  {
    id: "business",
    name: "Business",
    monthlyPriceCentavos: 99_900,
    yearlyPriceCentavos: 999_000,
    custom: false,
    recommended: true,
    summary: "For growing businesses that need more capacity and industry-enabled tools.",
    highlights: ["2 branches", "15 staff", "Growing-team capacity", "Additional capabilities where available for your industry"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPriceCentavos: 199_900,
    yearlyPriceCentavos: 1_999_000,
    custom: false,
    summary: "For established teams with higher volume and more locations.",
    highlights: ["5 branches", "50 staff", "Higher operating capacity", "Includes Business capabilities available for your industry"],
  },
  {
    id: "multi_branch",
    name: "Multi-Branch",
    monthlyPriceCentavos: 0,
    yearlyPriceCentavos: null,
    custom: true,
    summary: "A tailored plan for larger multi-location operations.",
    highlights: ["Custom branch and staff limits", "High-volume operations", "Launch support", "Tailored rollout"],
  },
] as const;

export function findLaunchPlan(planId: string) {
  return launchPlanCatalog.find((plan) => plan.id === planId);
}

export function formatPlanPrice(priceCentavos: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(priceCentavos / 100);
}

export function planMatchesLaunchCatalog(plan: {
  id: string;
  name: string;
  monthly_price_centavos: number;
  yearly_price_centavos: number | null;
  is_custom: boolean;
}) {
  const catalogPlan = findLaunchPlan(plan.id);
  if (!catalogPlan) return false;
  return catalogPlan.name === plan.name
    && catalogPlan.monthlyPriceCentavos === Number(plan.monthly_price_centavos)
    && catalogPlan.yearlyPriceCentavos === (plan.yearly_price_centavos == null ? null : Number(plan.yearly_price_centavos))
    && catalogPlan.custom === plan.is_custom;
}

export function visiblePlanFeatureLabels(industry: string, features: Record<string, boolean>) {
  if (industry !== "automotive" && industry !== "salon") return [];

  const labels: string[] = [];
  if (features.public_page) labels.push("Public business page");
  if (features.reminders) labels.push(industry === "salon" ? "Appointment reminders" : "Maintenance reminders");
  if (industry === "automotive" && features.advanced_reports) labels.push("Advanced Automotive reports");

  // `ai` exists in the historical entitlement catalog but has no launch-ready
  // customer workflow. Do not advertise it until the product enables one.
  return labels;
}
