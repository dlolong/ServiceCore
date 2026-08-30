-- Supabase local image versions may install permissive default table grants.
-- ServiceCore anonymous access is RPC-only, so make that contract explicit.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

