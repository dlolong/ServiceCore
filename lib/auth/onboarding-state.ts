export type OnboardingDestination =
  | { path: "/onboarding/business"; organizationId: null }
  | { path: "/onboarding/branch"; organizationId: string }
  | { path: "/dashboard"; organizationId: string };

export type OnboardingMembershipState = {
  organizationId: string;
  hasActiveBranch: boolean;
};

export function selectOnboardingDestination(states: OnboardingMembershipState[], preferredOrganizationId?: string | null): OnboardingDestination {
  if (states.length === 0) return { path: "/onboarding/business", organizationId: null };

  const selected = states.find(({ organizationId }) => organizationId === preferredOrganizationId)
    ?? states.find(({ hasActiveBranch }) => hasActiveBranch)
    ?? states[0];

  return {
    path: selected.hasActiveBranch ? "/dashboard" : "/onboarding/branch",
    organizationId: selected.organizationId,
  };
}
