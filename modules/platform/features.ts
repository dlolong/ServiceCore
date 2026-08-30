import type { Permission } from "@/lib/rbac";
import type { IndustryFeatureKey } from "@/modules/platform/industry";

export const subscriptionFeatureKeys = ["public_page", "reminders", "advanced_reports", "ai"] as const;
export type SubscriptionFeatureKey = (typeof subscriptionFeatureKeys)[number];

export type FeatureAccessRequirement = {
  industryFeature?: IndustryFeatureKey;
  subscriptionFeature?: SubscriptionFeatureKey;
  permission?: Permission;
};

export type FeatureAccessContext = {
  supportedIndustryFeatures: ReadonlySet<IndustryFeatureKey>;
  subscriptionEntitlements: ReadonlySet<SubscriptionFeatureKey>;
  permissions: ReadonlySet<Permission>;
};

/** Presentation helper only. Server authorization and RLS remain authoritative. */
export function hasFeatureAccess(requirement: FeatureAccessRequirement, context: FeatureAccessContext) {
  if (requirement.industryFeature && !context.supportedIndustryFeatures.has(requirement.industryFeature)) return false;
  if (requirement.subscriptionFeature && !context.subscriptionEntitlements.has(requirement.subscriptionFeature)) return false;
  if (requirement.permission && !context.permissions.has(requirement.permission)) return false;
  return true;
}
