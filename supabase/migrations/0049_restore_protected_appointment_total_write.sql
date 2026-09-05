-- Preserve the legacy harmless total-manipulation contract: authenticated
-- callers may target this derived column, but appointments_protect_estimates
-- always replaces it with the authoritative Appointment-Service total.
grant update(expected_total_centavos) on table public.appointments to authenticated;
