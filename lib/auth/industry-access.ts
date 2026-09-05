import "server-only";

import { notFound } from "next/navigation";

import { getDashboardContext, type OrganizationMembership } from "@/lib/auth/context";
import { industrySupportsFeature, resolveIndustryConfig, type IndustryFeatureKey, type IndustryKey } from "@/modules/platform/industry";

export class IndustryAccessError extends Error {
  constructor() {
    super("This feature is not available for the active organization.");
    this.name = "IndustryAccessError";
  }
}

export function assertIndustry(activeMembership: OrganizationMembership, industry: IndustryKey) {
  if (activeMembership.industry !== industry) throw new IndustryAccessError();
}

export function assertIndustryFeature(activeMembership: OrganizationMembership, feature: IndustryFeatureKey) {
  if (!industrySupportsFeature(resolveIndustryConfig(activeMembership.industry), feature)) throw new IndustryAccessError();
}

export async function requireIndustryFeature(feature: IndustryFeatureKey) {
  const context = await getDashboardContext();
  try {
    assertIndustryFeature(context.activeMembership, feature);
  } catch {
    notFound();
  }
  return context;
}

export async function requireAutomotiveContext() {
  const context = await getDashboardContext();
  assertIndustry(context.activeMembership, "automotive");
  return context;
}
