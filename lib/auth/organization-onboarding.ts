import type { PublicProductKey } from "@/modules/platform/product-entry";

type OrganizationRpcResult = {
  data: unknown;
  error: { code?: string } | null;
};

type CallOrganizationRpc = (
  parameters: Record<string, string | null>,
) => PromiseLike<OrganizationRpcResult>;

export type CreateFirstOrganizationInput = {
  industry: PublicProductKey;
  businessName: string;
  businessType: string;
  slug: string;
  legalName?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebookPage?: string;
};

export type CreateFirstOrganizationResult = {
  organizationId: string | null;
  errorCode: string | null;
};

/**
 * Keeps KarKR onboarding available while the application and database are
 * deployed in either order. The legacy RPC always creates Automotive tenants,
 * so it must never be used for Salon onboarding.
 */
export async function createFirstOrganizationWithCompatibility(
  callOrganizationRpc: CallOrganizationRpc,
  input: CreateFirstOrganizationInput,
): Promise<CreateFirstOrganizationResult> {
  const sharedParameters = {
    p_name: input.businessName,
    p_business_type: input.businessType,
    p_slug_base: input.slug,
    p_legal_name: input.legalName || null,
    p_phone: input.phone || null,
    p_email: input.email || null,
    p_website: input.website || null,
    p_facebook_page: input.facebookPage || null,
  };
  const currentResult = await callOrganizationRpc({
    ...sharedParameters,
    p_industry: input.industry,
  });

  if (!currentResult.error) {
    return {
      organizationId: typeof currentResult.data === "string" ? currentResult.data : null,
      errorCode: typeof currentResult.data === "string" ? null : "INVALID_RPC_RESPONSE",
    };
  }

  if (currentResult.error.code !== "PGRST202") {
    return { organizationId: null, errorCode: currentResult.error.code ?? "UNKNOWN" };
  }

  if (input.industry !== "automotive") {
    return { organizationId: null, errorCode: "ONBOARDING_SCHEMA_OUTDATED" };
  }

  const legacyResult = await callOrganizationRpc(sharedParameters);
  if (legacyResult.error) {
    return { organizationId: null, errorCode: legacyResult.error.code ?? "UNKNOWN" };
  }

  return {
    organizationId: typeof legacyResult.data === "string" ? legacyResult.data : null,
    errorCode: typeof legacyResult.data === "string" ? null : "INVALID_RPC_RESPONSE",
  };
}
