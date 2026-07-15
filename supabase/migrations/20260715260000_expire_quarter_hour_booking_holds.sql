-- A hold created immediately before the half-hour migration must not be
-- restored into a flow that can no longer confirm it.

update public.public_booking_holds
set status = 'expired'
where status = 'active'
  and extract(minute from starts_at)::integer % 30 <> 0;
