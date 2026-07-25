update public.admin_media_assets
set status = case
  when alt_text ~ '[^[:space:]]' then 'ready'
  else 'needs_alt'
end
where status in ('ready', 'needs_alt')
  and (
    (status = 'ready' and not (alt_text ~ '[^[:space:]]'))
    or (status = 'needs_alt' and alt_text ~ '[^[:space:]]')
  );

alter table public.admin_media_assets
  drop constraint if exists admin_media_assets_alt_status_check;

alter table public.admin_media_assets
  add constraint admin_media_assets_alt_status_check
  check (
    status = 'draft'
    or (status = 'ready' and alt_text ~ '[^[:space:]]')
    or (status = 'needs_alt' and not (alt_text ~ '[^[:space:]]'))
  );
