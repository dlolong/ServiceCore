import "server-only";

import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { normalizeSharedCommandCenterRows, resolveCommandCenterScope } from "@/modules/core/command-center/command-center.service";
import type { SharedCommandCenterMetricRow, SharedCommandCenterSnapshot } from "@/modules/core/command-center/command-center.types";

export async function getSharedCommandCenterSnapshot(requestedBranch?: string | null): Promise<SharedCommandCenterSnapshot> {
  const { activeMembership } = await getDashboardContext();
  const scope = resolveCommandCenterScope(activeMembership, requestedBranch);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_command_center_shared_metrics", {
    p_organization_id: scope.organizationId,
    p_branch_ids: scope.branchIds,
  });

  if (error) throw new Error("Unable to load Command Center metrics.", { cause: error });
  const { metrics, branchPerformance } = normalizeSharedCommandCenterRows(scope, (data ?? []) as SharedCommandCenterMetricRow[]);

  return { scope, metrics, branchPerformance, actions: [], operations: [], staff: [] };
}
