-- Make pgcrypto available to the invitation functions without exposing a mutable schema.
alter function public.create_staff_invitation(uuid,text,public.organization_role,uuid[],integer) set search_path=public,extensions,pg_temp;
alter function public.accept_staff_invitation(text) set search_path=public,extensions,pg_temp;
