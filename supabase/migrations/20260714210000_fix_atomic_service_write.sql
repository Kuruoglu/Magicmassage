create or replace function public.admin_save_service_aggregate(
  p_service jsonb,
  p_translations jsonb,
  p_placements jsonb,
  p_actor_user_id uuid,
  p_audit_metadata jsonb
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  target_service_slug text := p_service ->> 'slug';
  service_status text := p_service ->> 'status';
  cover_media_id text := nullif(p_service ->> 'cover_media_id', '');
  cover_placement_key text := 'service:' || (p_service ->> 'slug') || ':cover';
begin
  if jsonb_typeof(p_service) <> 'object'
    or jsonb_typeof(p_translations) <> 'array'
    or jsonb_typeof(p_placements) <> 'array'
    or jsonb_typeof(p_audit_metadata) <> 'object'
  then
    raise exception 'Invalid service aggregate payload.' using errcode = '22023';
  end if;

  if p_actor_user_id is null or nullif(btrim(target_service_slug), '') is null then
    raise exception 'A verified actor and service slug are required.' using errcode = '22023';
  end if;

  if service_status = 'published' and not exists (
    select 1
    from public.admin_media_assets media
    where media.id = cover_media_id
      and media.url = p_service ->> 'cover_image_url'
      and media.media_type = 'photo'
      and media.status = 'ready'
      and btrim(media.alt_text) <> ''
      and media.publication_consent_status in ('granted', 'not_required')
  ) then
    raise exception 'Published service cover is not publication-ready.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_placements) placement
    where placement ->> 'placement_key' <> cover_placement_key
      or placement ->> 'page_key' <> 'service:' || target_service_slug
      or placement ->> 'slot_key' <> 'cover'
      or placement ->> 'media_asset_id' is distinct from cover_media_id
  ) then
    raise exception 'Invalid service cover placement.' using errcode = '22023';
  end if;

  insert into public.admin_services (
    slug,
    name,
    category,
    status,
    duration_label,
    locale_codes,
    seo_title,
    summary,
    cover_image_url,
    cover_media_id,
    display_order
  )
  values (
    target_service_slug,
    p_service ->> 'name',
    p_service ->> 'category',
    service_status,
    p_service ->> 'duration_label',
    array(select jsonb_array_elements_text(coalesce(p_service -> 'locale_codes', '[]'::jsonb))),
    p_service ->> 'seo_title',
    p_service ->> 'summary',
    p_service ->> 'cover_image_url',
    cover_media_id,
    (p_service ->> 'display_order')::integer
  )
  on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
    status = excluded.status,
    duration_label = excluded.duration_label,
    locale_codes = excluded.locale_codes,
    seo_title = excluded.seo_title,
    summary = excluded.summary,
    cover_image_url = excluded.cover_image_url,
    cover_media_id = excluded.cover_media_id,
    display_order = excluded.display_order;

  insert into public.admin_service_translations (
    service_slug,
    locale,
    status,
    title,
    short_description,
    body,
    seo_title,
    seo_description,
    canonical_url,
    robots_directives,
    og_title,
    og_description,
    og_image_media_id
  )
  select
    translation.service_slug,
    translation.locale,
    translation.status,
    translation.title,
    translation.short_description,
    translation.body,
    translation.seo_title,
    translation.seo_description,
    translation.canonical_url,
    translation.robots_directives,
    translation.og_title,
    translation.og_description,
    translation.og_image_media_id
  from jsonb_to_recordset(p_translations) as translation(
    service_slug text,
    locale text,
    status text,
    title text,
    short_description text,
    body text,
    seo_title text,
    seo_description text,
    canonical_url text,
    robots_directives text,
    og_title text,
    og_description text,
    og_image_media_id text
  )
  on conflict (service_slug, locale) do update set
    status = excluded.status,
    title = excluded.title,
    short_description = excluded.short_description,
    body = excluded.body,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    canonical_url = excluded.canonical_url,
    robots_directives = excluded.robots_directives,
    og_title = excluded.og_title,
    og_description = excluded.og_description,
    og_image_media_id = excluded.og_image_media_id;

  delete from public.admin_media_placements placement
  where placement.placement_key = cover_placement_key
    and not exists (
      select 1
      from jsonb_to_recordset(p_placements) as incoming(locale text)
      where incoming.locale is not distinct from placement.locale
    );

  insert into public.admin_media_placements (
    media_asset_id,
    placement_key,
    page_key,
    slot_key,
    locale,
    is_published,
    sort_order,
    caption_localized,
    publish_at
  )
  select
    placement.media_asset_id,
    placement.placement_key,
    placement.page_key,
    placement.slot_key,
    placement.locale,
    placement.is_published,
    placement.sort_order,
    placement.caption_localized,
    placement.publish_at
  from jsonb_to_recordset(p_placements) as placement(
    media_asset_id text,
    placement_key text,
    page_key text,
    slot_key text,
    locale text,
    is_published boolean,
    sort_order integer,
    caption_localized jsonb,
    publish_at timestamptz
  )
  on conflict (placement_key, (coalesce(locale, '*'::text))) do update set
    media_asset_id = excluded.media_asset_id,
    page_key = excluded.page_key,
    slot_key = excluded.slot_key,
    is_published = excluded.is_published,
    sort_order = excluded.sort_order,
    caption_localized = excluded.caption_localized,
    publish_at = excluded.publish_at;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  values (
    p_actor_user_id,
    'service.visibility',
    'admin_services',
    target_service_slug,
    p_audit_metadata
  );
end;
$$;

revoke all on function public.admin_save_service_aggregate(jsonb, jsonb, jsonb, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_save_service_aggregate(jsonb, jsonb, jsonb, uuid, jsonb)
  to service_role;
