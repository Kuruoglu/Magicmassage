alter table public.admin_blog_posts
  add column if not exists cover_alt_text text not null default '';

update public.admin_blog_posts
set cover_alt_text = title
where btrim(cover_alt_text) = '';

create or replace function public.set_admin_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'admin_appointments',
    'admin_blog_posts',
    'admin_clients',
    'admin_media_assets',
    'admin_media_placements',
    'admin_service_translations',
    'admin_services',
    'admin_site_settings'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_admin_updated_at()',
      table_name
    );
  end loop;
end;
$$;

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
  post.updated_at,
  post.cover_alt_text
from public.admin_blog_posts post
where (
    (post.status = 'published' and post.published_at <= now())
    or (post.status = 'scheduled' and post.scheduled_for <= now())
  )
  and (post.unpublished_at is null or post.unpublished_at > now())
  and btrim(post.sanitized_html) <> '';

revoke all on public.admin_published_blog_posts from public;
grant select on public.admin_published_blog_posts to anon, authenticated, service_role;
