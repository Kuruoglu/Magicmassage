-- Serialization SQLSTATEs are reserved for database retries, not UI conflicts.
-- Patch already-installed function bodies while remaining a no-op on fresh databases
-- where the preceding migrations already use domain error codes.

do $migration$
declare
  appointment_definition text;
  block_definition text;
begin
  select pg_get_functiondef(
    'public.admin_save_appointment_with_audit(jsonb,uuid,text,jsonb)'::regprocedure
  ) into appointment_definition;

  if position('errcode = ''40001''' in appointment_definition) > 0 then
    execute replace(
      appointment_definition,
      'errcode = ''40001''',
      'errcode = ''P0001'''
    );
  end if;

  select pg_get_functiondef(
    'public.admin_mutate_calendar_block(text,uuid,date,time without time zone,time without time zone,text,text,uuid,integer)'::regprocedure
  ) into block_definition;

  if position('errcode = ''40001''' in block_definition) > 0 then
    execute replace(
      block_definition,
      'errcode = ''40001''',
      'errcode = ''P0001'''
    );
  end if;
end;
$migration$;
