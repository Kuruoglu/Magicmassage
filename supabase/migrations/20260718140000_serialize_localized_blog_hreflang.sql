-- Serialize writes within one logical article so every sibling receives the
-- same hreflang map when translations are saved concurrently.

create or replace function public.admin_save_localized_blog_post_aggregate(
  p_post jsonb,
  p_placement jsonb,
  p_actor_user_id uuid,
  p_audit_metadata jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  actor_role text;
  existing_locale text;
  existing_translation_key text;
  is_existing boolean := false;
  post_id text := p_post ->> 'id';
  post_locale text := p_post ->> 'locale';
  post_slug text := p_post ->> 'slug';
  post_translation_key text := p_post ->> 'translation_key';
begin
  if jsonb_typeof(p_post) is distinct from 'object'
    or nullif(btrim(post_id), '') is null
    or post_locale not in ('bg', 'ru', 'ua', 'en')
    or jsonb_typeof(p_post -> 'locale_codes') is distinct from 'array'
    or jsonb_array_length(p_post -> 'locale_codes') <> 1
    or p_post -> 'locale_codes' ->> 0 is distinct from post_locale
    or post_translation_key is null
    or post_translation_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception 'Invalid localized blog aggregate payload.' using errcode = '22023';
  end if;

  select profile.role
  into actor_role
  from public.admin_profiles profile
  where profile.user_id = p_actor_user_id
    and profile.status = 'active';

  if actor_role is null or actor_role not in ('owner', 'administrator', 'editor') then
    raise exception 'Forbidden localized blog write.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(post_translation_key, 0));

  select post.translation_key, post.locale
  into existing_translation_key, existing_locale
  from public.admin_blog_posts post
  where post.id = post_id
  for update;
  is_existing := found;

  if is_existing and existing_translation_key is distinct from post_translation_key then
    raise exception 'blog_translation_key_immutable' using errcode = '23514';
  end if;

  if is_existing and existing_locale is distinct from post_locale then
    raise exception 'blog_locale_immutable' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.admin_blog_posts post
    where post.translation_key = post_translation_key
      and post.locale = post_locale
      and post.id <> post_id
  ) then
    raise exception 'blog_translation_locale_conflict' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.admin_blog_posts post
    where post.locale = post_locale
      and post.slug = post_slug
      and post.id <> post_id
  ) then
    raise exception 'blog_locale_slug_conflict' using errcode = '23505';
  end if;

  perform public.admin_save_blog_post_aggregate(
    p_post,
    p_placement,
    p_actor_user_id,
    p_audit_metadata || jsonb_build_object(
      'locale', post_locale,
      'operation', case when is_existing then 'update' else 'create' end,
      'translationKey', post_translation_key,
      'verifiedRole', actor_role
    )
  );

  update public.admin_blog_posts post
  set translation_key = post_translation_key
  where post.id = post_id
    and post.locale = post_locale;

  if not found then
    raise exception 'Saved blog translation could not be linked.' using errcode = 'P0002';
  end if;

  with public_alternates as (
    select jsonb_object_agg(post.locale, post.canonical_url order by post.locale) as hreflang
    from public.admin_blog_posts post
    where post.translation_key = post_translation_key
      and (
        (post.status = 'published' and post.published_at <= now())
        or (post.status = 'scheduled' and post.scheduled_for <= now())
      )
      and (post.unpublished_at is null or post.unpublished_at > now())
      and btrim(post.sanitized_html) <> ''
  )
  update public.admin_blog_posts post
  set hreflang = coalesce(alternates.hreflang, '{}'::jsonb)
  from public_alternates alternates
  where post.translation_key = post_translation_key;
end;
$$;

revoke all on function public.admin_save_localized_blog_post_aggregate(jsonb, jsonb, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.admin_save_localized_blog_post_aggregate(jsonb, jsonb, uuid, jsonb)
  to service_role;
