alter table public.admin_media_placements
  add column if not exists publish_at timestamptz;

comment on column public.admin_media_placements.publish_at is
  'Optional instant after which a published placement may be served publicly.';

-- Repository-owned media already shipped from public/media does not require a
-- third-party publication release. This is a one-time backfill only.
update public.admin_media_assets
set publication_consent_status = 'not_required'
where publication_consent_status = 'unknown'
  and url like '/media/%';

-- These placements mirror references that were already live in the public app
-- before the relational placement registry was introduced.
update public.admin_media_placements
set is_published = true
where not is_published
  and (
    placement_key like 'inventory:%'
    or placement_key like 'service:%:cover'
    or placement_key like 'home.%'
    or placement_key like 'about.%'
    or placement_key like 'gift-certificates.%'
    or placement_key like 'global.%'
  );

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
      and (placement.publish_at is null or placement.publish_at <= now())
  )
);

grant select (
  id,
  media_asset_id,
  placement_key,
  page_key,
  slot_key,
  locale,
  is_published,
  publish_at,
  sort_order,
  caption_localized,
  updated_at
) on public.admin_media_placements to anon;

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
  and (placement.publish_at is null or placement.publish_at <= now())
  and media.status = 'ready'
  and media.publication_consent_status in ('granted', 'not_required');

grant select (scheduled_for) on public.admin_blog_posts to anon;

drop policy if exists "public can read published blog posts" on public.admin_blog_posts;
create policy "public can read published blog posts"
on public.admin_blog_posts
for select
to anon
using (
  (
    (status = 'published' and published_at <= now())
    or (status = 'scheduled' and scheduled_for <= now())
  )
  and (unpublished_at is null or unpublished_at > now())
  and btrim(sanitized_html) <> ''
);

create or replace view public.admin_published_blog_posts
with (security_invoker = true, security_barrier = true)
as
select
  post.id,
  post.slug,
  post.locale,
  post.title,
  post.category,
  post.author,
  post.tag_labels,
  post.sanitized_html,
  post.canonical_url,
  post.meta_description,
  post.robots_directives,
  post.og_title,
  post.og_description,
  post.cover_media_id,
  post.og_image_media_id,
  post.hreflang,
  coalesce(post.published_at, post.scheduled_for) as published_at,
  post.unpublished_at,
  post.updated_at
from public.admin_blog_posts post
where (
    (post.status = 'published' and post.published_at <= now())
    or (post.status = 'scheduled' and post.scheduled_for <= now())
  )
  and (post.unpublished_at is null or post.unpublished_at > now())
  and btrim(post.sanitized_html) <> '';

revoke all on public.admin_published_media_placements from public;
revoke all on public.admin_published_blog_posts from public;
grant select on public.admin_published_media_placements to anon, authenticated, service_role;
grant select on public.admin_published_blog_posts to anon, authenticated, service_role;
