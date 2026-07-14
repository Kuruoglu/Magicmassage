alter table public.admin_media_assets
  add column if not exists source_path text,
  add column if not exists original_filename text,
  add column if not exists file_extension text,
  add column if not exists publication_consent_status text not null default 'unknown',
  add column if not exists replaces_media_asset_id text,
  add column if not exists version integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_media_assets'::regclass
      and conname = 'admin_media_assets_publication_consent_check'
  ) then
    alter table public.admin_media_assets
      add constraint admin_media_assets_publication_consent_check
      check (publication_consent_status in ('unknown', 'granted', 'not_required', 'denied'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_media_assets'::regclass
      and conname = 'admin_media_assets_replacement_fkey'
  ) then
    alter table public.admin_media_assets
      add constraint admin_media_assets_replacement_fkey
      foreign key (replaces_media_asset_id)
      references public.admin_media_assets(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_media_assets'::regclass
      and conname = 'admin_media_assets_version_check'
  ) then
    alter table public.admin_media_assets
      add constraint admin_media_assets_version_check
      check (version > 0);
  end if;
end
$$;

update public.admin_media_assets
set
  original_filename = coalesce(original_filename, regexp_replace(url, '^.*/', '')),
  file_extension = coalesce(file_extension, lower(nullif(substring(url from '\.([^.?#/]+)(?:[?#].*)?$'), ''))),
  source_path = coalesce(source_path, url)
where original_filename is null
   or file_extension is null
   or source_path is null;

create index if not exists admin_media_assets_consent_status_idx
  on public.admin_media_assets (publication_consent_status, status);

create or replace view public.admin_published_media_placements
with (security_invoker = true, security_barrier = true)
as
select
  placement.id,
  placement.placement_key,
  placement.page_key,
  placement.slot_key,
  placement.locale,
  placement.sort_order,
  placement.caption_localized,
  media.id as media_asset_id,
  media.url,
  media.mime_type,
  media.byte_size,
  media.width_pixels,
  media.height_pixels,
  media.alt_text,
  media.alt_text_localized,
  greatest(placement.updated_at, media.updated_at) as updated_at
from public.admin_media_placements placement
join public.admin_media_assets media on media.id = placement.media_asset_id
where placement.is_published
  and media.status = 'ready'
  and media.publication_consent_status in ('granted', 'not_required');

revoke all on public.admin_published_media_placements from public;
grant select on public.admin_published_media_placements to anon, authenticated, service_role;
