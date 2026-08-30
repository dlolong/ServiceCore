import "server-only";

import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  EstimateApprovalError,
  type EstimateApprovalLinkPersistence,
  hashEstimateApprovalToken,
  parsePublicEstimateApproval,
} from "@/modules/automotive/work-execution/estimate-approval";

function controlledError(error: { message: string } | null, fallback: string): never {
  const safeMessages = ["current undecided estimate", "no longer active", "estimate not found"];
  throw new EstimateApprovalError(error && safeMessages.some((part) => error.message.toLowerCase().includes(part)) ? error.message : fallback);
}

export const estimateApprovalLinkPersistence: EstimateApprovalLinkPersistence = {
  async create(input) {
    await getDashboardContext();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_estimate_approval_link", {
      p_estimate_id: input.estimateId,
      p_token_hash: input.tokenHash,
      p_expires_at: input.expiresAt,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result) controlledError(error, "Unable to create an approval link.");
    return { linkId: result.link_id as string, expiresAt: result.expires_at as string };
  },
  async revoke(linkId) {
    await getDashboardContext();
    const supabase = await createClient();
    const { error } = await supabase.rpc("revoke_estimate_approval_link", { p_link_id: linkId });
    if (error) controlledError(error, "Unable to revoke the approval link.");
  },
};

export async function getPublicEstimateApproval(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_estimate_approval", { p_token_hash: hashEstimateApprovalToken(token) });
  if (error) throw new EstimateApprovalError("This estimate cannot be displayed right now.");
  return parsePublicEstimateApproval(data);
}

export async function decidePublicEstimateApproval(token: string, decision: "approve" | "decline", comment: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_public_estimate_approval", {
    p_token_hash: hashEstimateApprovalToken(token),
    p_decision: decision,
    p_comment: comment || null,
  });
  if (error || !data || typeof data !== "object" || !("state" in data)) throw new EstimateApprovalError("Your decision could not be recorded. Please try again.");
  return data as { state: string; idempotent?: boolean };
}
