export type OnboardingDestination =
  | { path: "/onboarding/business"; organizationId: null }
  | { path: "/organizations"; organizationId: null }
  | { path: "/onboarding/branch"; organizationId: string }
  | { path: "/dashboard"; organizationId: string };

export type OnboardingMembershipState = {
  organizationId: string;
  hasActiveBranch: boolean;
};

export function selectActiveMembership<T extends { organizationId: string }>(memberships: T[], requestedOrganizationId?: string | null): T | null {
  const requested = memberships.find(({ organizationId }) => organizationId === requestedOrganizationId);
  if (requested) return requested;
  return memberships.length === 1 ? memberships[0] : null;
}

export function selectOnboardingDestination(states: OnboardingMembershipState[], preferredOrganizationId?: string | null): OnboardingDestination {
  if (states.length === 0) return { path: "/onboarding/business", organizationId: null };

  const preferred = states.find(({ organizationId }) => organizationId === preferredOrganizationId);
  if (!preferred && states.length > 1) return { path: "/organizations", organizationId: null };

  const selected = preferred ?? states[0];

  return {
    path: selected.hasActiveBranch ? "/dashboard" : "/onboarding/branch",
    organizationId: selected.organizationId,
  };
}
