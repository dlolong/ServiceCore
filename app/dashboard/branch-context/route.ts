import { NextRequest, NextResponse } from "next/server";

import { ACTIVE_BRANCH_COOKIE, getDashboardContext } from "@/lib/auth/context";
import { parseDashboardBranchContext } from "@/modules/platform/command-center-branch-context";

const branchCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function GET(request: NextRequest) {
  const parsed = parseDashboardBranchContext(request.nextUrl.searchParams);
  if (!parsed.success) return redirectWithError(request, "Invalid branch selection.");

  if (parsed.data.branch === "all") {
    // All Branches is a read-only Command Center scope. Preserve the concrete
    // active-branch cookie used by operational pages.
    return NextResponse.redirect(new URL("/dashboard?branch=all", request.url));
  }

  const { activeMembership } = await getDashboardContext();
  if (!activeMembership.branches.some(({ id }) => id === parsed.data.branch)) {
    return redirectWithError(request, "You do not have access to that branch.");
  }

  const response = NextResponse.redirect(new URL(parsed.data.next, request.url));
  response.cookies.set(ACTIVE_BRANCH_COOKIE, parsed.data.branch, branchCookieOptions);
  return response;
}

function redirectWithError(request: NextRequest, message: string) {
  const target = new URL("/dashboard", request.url);
  target.searchParams.set("error", message);
  return NextResponse.redirect(target);
}
