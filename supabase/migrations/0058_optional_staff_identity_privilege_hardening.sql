-- Table privilege hardening for operational Staff profiles. RLS does not cover
-- TRUNCATE/REFERENCES/TRIGGER privileges, so authenticated callers receive only
-- the explicitly allowlisted directory columns.

revoke all on table public.organization_staff_profiles from public,anon,authenticated;
grant select(
  id,organization_id,membership_id,full_name,job_function,
  specializations,is_active,created_at,updated_at
) on table public.organization_staff_profiles to authenticated;
grant all on table public.organization_staff_profiles to service_role;

