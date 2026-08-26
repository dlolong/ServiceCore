# Schema notes

The initial migrations deliberately create broad domain tables but only baseline policies. Each roadmap phase must tighten permissions as workflows become more specific.

Known intentional gaps for Codex to address in phases:
- organization creation needs a safe onboarding RPC in Phase 01 because a brand-new user is not yet a member;
- technician job-write permissions are broad at baseline and must become transition/assignment-aware in Phase 05/09;
- invoice/estimate tables are intentionally added in Phase 06 rather than guessed here;
- public booking RLS is not enabled until Phase 10;
- storage buckets/policies are deferred to Phase 05;
- branch-level membership restrictions are deferred to Phase 09;
- billing webhooks are service-role only and Stripe tables/logic are deferred to Phase 12;
- consumer vehicle ownership is a separate model deferred to Phase 13.

This is safer than pretending those future authorization models are complete today.
