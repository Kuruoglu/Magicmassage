-- Manual admin appointments may be adjacent even when public booking uses a cleanup buffer.
-- Public availability and hold RPCs continue to compare buffered ranges independently.

alter table public.admin_appointments
  drop constraint if exists admin_appointments_active_schedule_excl;

alter table public.admin_appointments
  add constraint admin_appointments_active_schedule_excl
  exclude using gist (
    (
      tsrange(
        starts_on + starts_at,
        starts_on + starts_at + make_interval(mins => duration_minutes),
        '[)'
      )
    ) with &&
  )
  where (
    status in ('confirmed', 'pending', 'request')
    and not overlap_override
  );
