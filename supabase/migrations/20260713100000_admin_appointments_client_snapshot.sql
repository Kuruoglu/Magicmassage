alter table public.admin_appointments
add column if not exists client_name_snapshot text;

update public.admin_appointments appointment
set client_name_snapshot = coalesce(nullif(client.full_name, ''), appointment.client_id)
from public.admin_clients client
where appointment.client_id = client.id
  and appointment.client_name_snapshot is null;

update public.admin_appointments
set client_name_snapshot = client_id
where client_name_snapshot is null;

alter table public.admin_appointments
alter column client_name_snapshot set not null;
