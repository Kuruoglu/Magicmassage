-- A valid existing hold remains confirmable after an owner adds manual overflow.
-- Capacity is still enforced for new holds and for assignment to another specialist.

create or replace function public.public_booking_specialist_available(
  p_specialist_id uuid,
  p_service_slug text,
  p_starts_on date,
  p_starts_at time without time zone,
  p_duration_minutes integer,
  p_buffer_minutes integer,
  p_excluded_hold_id uuid default null
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_specialists specialist
    join public.admin_specialist_services assignment
      on assignment.specialist_id = specialist.id
     and assignment.service_slug = p_service_slug
    where specialist.id = p_specialist_id
      and specialist.status = 'active'
      and specialist.public_booking_enabled
      and (
        (
          select count(*) from public.admin_appointments appointment
          where appointment.specialist_id = specialist.id
            and appointment.starts_on = p_starts_on
            and appointment.status <> 'cancelled'
        ) + (
          select count(*) from public.public_booking_holds hold
          where hold.specialist_id = specialist.id
            and hold.starts_on = p_starts_on
            and hold.status = 'active'
            and hold.expires_at > now()
            and (p_excluded_hold_id is null or hold.id <> p_excluded_hold_id)
        ) < specialist.public_daily_limit
        or exists (
          select 1 from public.public_booking_holds reserved_hold
          where reserved_hold.id = p_excluded_hold_id
            and reserved_hold.specialist_id = specialist.id
            and reserved_hold.status = 'active'
            and reserved_hold.expires_at > now()
        )
      )
      and not exists (
        select 1 from public.admin_calendar_blocks block
        where block.specialist_id = specialist.id
          and block.block_date = p_starts_on
          and tsrange(
            p_starts_on + p_starts_at,
            p_starts_on + p_starts_at + make_interval(mins => p_duration_minutes + p_buffer_minutes), '[)'
          ) && tsrange(block.block_date + block.starts_at, block.block_date + block.ends_at, '[)')
      )
      and not exists (
        select 1 from public.admin_appointments appointment
        where appointment.specialist_id = specialist.id
          and appointment.starts_on = p_starts_on
          and appointment.status in ('confirmed', 'pending', 'request')
          and tsrange(
            p_starts_on + p_starts_at,
            p_starts_on + p_starts_at + make_interval(mins => p_duration_minutes + p_buffer_minutes), '[)'
          ) && tsrange(
            appointment.starts_on + appointment.starts_at,
            appointment.starts_on + appointment.starts_at + make_interval(mins => appointment.duration_minutes + appointment.buffer_minutes), '[)'
          )
      )
      and not exists (
        select 1 from public.public_booking_holds hold
        where hold.specialist_id = specialist.id
          and hold.starts_on = p_starts_on
          and hold.status = 'active'
          and hold.expires_at > now()
          and (p_excluded_hold_id is null or hold.id <> p_excluded_hold_id)
          and tsrange(
            p_starts_on + p_starts_at,
            p_starts_on + p_starts_at + make_interval(mins => p_duration_minutes + p_buffer_minutes), '[)'
          ) && tsrange(
            hold.starts_on + hold.starts_at,
            hold.starts_on + hold.starts_at + make_interval(mins => hold.duration_minutes + hold.buffer_minutes), '[)'
          )
      )
  );
$$;

revoke all on function public.public_booking_specialist_available(
  uuid, text, date, time without time zone, integer, integer, uuid
) from public, anon, authenticated;
grant execute on function public.public_booking_specialist_available(
  uuid, text, date, time without time zone, integer, integer, uuid
) to service_role;
