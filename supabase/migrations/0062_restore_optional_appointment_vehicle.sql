-- Repair environments where the optional-vehicle contract from 0029 drifted.
-- Salon appointments have no vehicle. Automotive validates its required
-- vehicle in its adapter; the existing tenant/customer guards remain intact.
alter table public.appointments
  alter column vehicle_id drop not null;

notify pgrst, 'reload schema';
