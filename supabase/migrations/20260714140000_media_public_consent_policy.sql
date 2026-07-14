drop policy if exists "public can read referenced ready media" on public.admin_media_assets;
create policy "public can read referenced ready media"
on public.admin_media_assets
for select
to anon
using (
  status = 'ready'
  and publication_consent_status in ('granted', 'not_required')
  and exists (
    select 1
    from public.admin_media_placements placement
    where placement.media_asset_id = admin_media_assets.id
      and placement.is_published
  )
);

comment on policy "public can read referenced ready media" on public.admin_media_assets is
  'Anonymous media reads require a published placement plus explicit publication consent.';
