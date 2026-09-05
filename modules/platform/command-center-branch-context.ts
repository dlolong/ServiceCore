import { z } from "zod";

export const dashboardBranchContextDestinations = ["/dashboard", "/dashboard/inventory"] as const;

const branchContextSchema = z.object({
  branch: z.union([z.literal("all"), z.uuid()]),
  next: z.enum(dashboardBranchContextDestinations).default("/dashboard"),
}).superRefine((value, context) => {
  if (value.branch === "all" && value.next !== "/dashboard") context.addIssue({ code: "custom", message: "All Branches is only available on the Command Center." });
});

export function parseDashboardBranchContext(searchParams: URLSearchParams) {
  return branchContextSchema.safeParse({
    branch: searchParams.get("branch"),
    next: searchParams.get("next") ?? "/dashboard",
  });
}

export function dashboardBranchContextHref(branchId: string, next: (typeof dashboardBranchContextDestinations)[number]) {
  const search = new URLSearchParams({ branch: branchId, next });
  return `/dashboard/branch-context?${search}`;
}
