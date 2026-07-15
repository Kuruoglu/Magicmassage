create index if not exists public_booking_holds_confirmed_session_idx
  on public.public_booking_holds (session_key_hash, confirmed_at desc)
  where status = 'confirmed' and session_key_hash is not null;
