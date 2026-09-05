-- Preserve the legacy authenticated Appointment-Service mutation contract.
-- Tenant/snapshot triggers remain authoritative, while 0047 suppresses reminder
-- row triggers only inside its trusted scheduling replacement transaction.
grant insert,update,delete on table public.appointment_services to authenticated;
