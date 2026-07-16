-- The public booking keeps its service, price, locale, contact, and buffer snapshots.
-- Duration is operational calendar data after confirmation and may be adjusted by an admin.

do $migration$
declare
  appointment_definition text;
  prepare_definition text;
  immutable_duration_clause constant text := E'      or new.duration_minutes is distinct from old.duration_minutes\n';
  preserved_duration_block constant text := E'effective_duration_minutes := case\n    when current_exists and current_appointment.origin = ''public''\n      then current_appointment.duration_minutes\n    else requested_duration_minutes\n  end;';
begin
  select pg_get_functiondef(
    'public.admin_prepare_appointment_write()'::regprocedure
  ) into prepare_definition;

  if position(immutable_duration_clause in prepare_definition) > 0 then
    execute replace(prepare_definition, immutable_duration_clause, '');
  elsif position('new.duration_minutes is distinct from old.duration_minutes' in prepare_definition) > 0 then
    raise exception 'admin_prepare_appointment_write duration guard was not found';
  end if;

  select pg_get_functiondef(
    'public.admin_save_appointment_with_audit(jsonb,uuid,text,jsonb)'::regprocedure
  ) into appointment_definition;

  if position(preserved_duration_block in appointment_definition) > 0 then
    execute replace(
      appointment_definition,
      preserved_duration_block,
      'effective_duration_minutes := requested_duration_minutes;'
    );
  elsif position('effective_duration_minutes := requested_duration_minutes;' in appointment_definition) = 0 then
    raise exception 'admin_save_appointment_with_audit public duration override was not found';
  end if;
end;
$migration$;
