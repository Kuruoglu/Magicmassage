-- Keep the legacy booking envelope derived when a specialist is removed.

create or replace function public.admin_sync_specialist_schedule_envelope()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform public.admin_recompute_specialist_schedule_envelope();
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sync_specialist_schedule_envelope_on_delete on public.admin_specialists;
create trigger sync_specialist_schedule_envelope_on_delete
after delete on public.admin_specialists
for each row execute function public.admin_sync_specialist_schedule_envelope();

comment on function public.admin_sync_specialist_schedule_envelope() is
  'Recomputes the derived booking envelope after specialist insert, schedule/status update, or delete.';
