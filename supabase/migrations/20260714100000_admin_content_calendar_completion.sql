-- Complete the normalized content and calendar schema without replacing the
-- legacy columns that the current admin repository still reads.

alter table public.admin_media_assets
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists width_pixels integer,
  add column if not exists height_pixels integer,
  add column if not exists alt_text_localized jsonb not null default '{}'::jsonb;

update public.admin_media_assets
set
  mime_type = coalesce(
    mime_type,
    case
      when url ~* '\.(jpe?g)(\?.*)?$' then 'image/jpeg'
      when url ~* '\.png(\?.*)?$' then 'image/png'
      when url ~* '\.webp(\?.*)?$' then 'image/webp'
      when url ~* '\.avif(\?.*)?$' then 'image/avif'
      when url ~* '\.svg(\?.*)?$' then 'image/svg+xml'
      when url ~* '\.pdf(\?.*)?$' then 'application/pdf'
      else null
    end
  ),
  width_pixels = coalesce(
    width_pixels,
    nullif(substring(dimensions from '^\s*([0-9]+)\s*[xX]\s*[0-9]+\s*$'), '')::integer
  ),
  height_pixels = coalesce(
    height_pixels,
    nullif(substring(dimensions from '^\s*[0-9]+\s*[xX]\s*([0-9]+)\s*$'), '')::integer
  ),
  byte_size = coalesce(
    byte_size,
    case
      when file_size_label ~* '^\s*[0-9]+(\.[0-9]+)?\s*B\s*$'
        then round(regexp_replace(file_size_label, '[^0-9.]', '', 'g')::numeric)::bigint
      when file_size_label ~* '^\s*[0-9]+(\.[0-9]+)?\s*KB\s*$'
        then round(regexp_replace(file_size_label, '[^0-9.]', '', 'g')::numeric * 1024)::bigint
      when file_size_label ~* '^\s*[0-9]+(\.[0-9]+)?\s*MB\s*$'
        then round(regexp_replace(file_size_label, '[^0-9.]', '', 'g')::numeric * 1024 * 1024)::bigint
      when file_size_label ~* '^\s*[0-9]+(\.[0-9]+)?\s*GB\s*$'
        then round(regexp_replace(file_size_label, '[^0-9.]', '', 'g')::numeric * 1024 * 1024 * 1024)::bigint
      else null
    end
  )
where mime_type is null
   or width_pixels is null
   or height_pixels is null
   or byte_size is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_media_assets'::regclass
      and conname = 'admin_media_assets_byte_size_check'
  ) then
    alter table public.admin_media_assets
      add constraint admin_media_assets_byte_size_check
      check (byte_size is null or byte_size >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_media_assets'::regclass
      and conname = 'admin_media_assets_pixel_dimensions_check'
  ) then
    alter table public.admin_media_assets
      add constraint admin_media_assets_pixel_dimensions_check
      check (
        (width_pixels is null or width_pixels > 0)
        and (height_pixels is null or height_pixels > 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_media_assets'::regclass
      and conname = 'admin_media_assets_localized_alt_object_check'
  ) then
    alter table public.admin_media_assets
      add constraint admin_media_assets_localized_alt_object_check
      check (jsonb_typeof(alt_text_localized) = 'object');
  end if;
end
$$;

comment on column public.admin_media_assets.alt_text_localized is
  'Verified locale-to-alt-text map. A later media import must populate real translations; legacy alt_text is intentionally not copied to every locale.';

alter table public.admin_services
  add column if not exists cover_media_id text,
  add column if not exists default_duration_minutes integer;

update public.admin_services service
set cover_media_id = media.id
from public.admin_media_assets media
where service.cover_media_id is null
  and nullif(service.cover_image_url, '') is not null
  and media.url = service.cover_image_url;

with preferred_duration as (
  select distinct on (price.service_slug)
    price.service_slug,
    price.duration_minutes
  from public.admin_price_variants price
  order by
    price.service_slug,
    case when price.status = 'active' then 0 else 1 end,
    price.display_order,
    price.duration_minutes
)
update public.admin_services service
set default_duration_minutes = preferred.duration_minutes
from preferred_duration preferred
where service.slug = preferred.service_slug
  and service.default_duration_minutes is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_services'::regclass
      and conname = 'admin_services_cover_media_id_fkey'
  ) then
    alter table public.admin_services
      add constraint admin_services_cover_media_id_fkey
      foreign key (cover_media_id)
      references public.admin_media_assets(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_services'::regclass
      and conname = 'admin_services_default_duration_minutes_check'
  ) then
    alter table public.admin_services
      add constraint admin_services_default_duration_minutes_check
      check (default_duration_minutes is null or default_duration_minutes > 0);
  end if;
end
$$;

create table if not exists public.admin_service_translations (
  service_slug text not null references public.admin_services(slug) on update cascade on delete cascade,
  locale text not null check (locale in ('bg', 'ru', 'ua', 'en')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  title text not null,
  short_description text not null default '',
  body text not null default '',
  seo_title text not null default '',
  seo_description text not null default '',
  canonical_url text not null default '',
  robots_directives text not null default 'index,follow',
  og_title text not null default '',
  og_description text not null default '',
  og_image_media_id text references public.admin_media_assets(id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_slug, locale),
  check (btrim(title) <> ''),
  check (btrim(robots_directives) <> '')
);

comment on table public.admin_service_translations is
  'Normalized service locale content. Populate complete, reviewed rows with a later content import; this migration intentionally does not clone legacy copy across locales.';

create table if not exists public.admin_media_placements (
  id uuid primary key default gen_random_uuid(),
  media_asset_id text not null references public.admin_media_assets(id) on update cascade on delete restrict,
  placement_key text not null check (btrim(placement_key) <> ''),
  page_key text not null check (btrim(page_key) <> ''),
  slot_key text not null check (btrim(slot_key) <> ''),
  locale text check (locale in ('bg', 'ru', 'ua', 'en')),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  caption_localized jsonb not null default '{}'::jsonb check (jsonb_typeof(caption_localized) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.admin_media_placements is
  'Relational public-media placement registry. A later media import must create only verified page and locale placements.';

alter table public.admin_blog_posts
  add column if not exists editor_json jsonb not null default '{}'::jsonb,
  add column if not exists sanitized_html text not null default '',
  add column if not exists canonical_url text not null default '',
  add column if not exists meta_description text not null default '',
  add column if not exists robots_directives text not null default 'index,follow',
  add column if not exists og_title text not null default '',
  add column if not exists og_description text not null default '',
  add column if not exists cover_media_id text,
  add column if not exists og_image_media_id text,
  add column if not exists locale text,
  add column if not exists hreflang jsonb not null default '{}'::jsonb,
  add column if not exists scheduled_for timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists unpublished_at timestamptz;

update public.admin_blog_posts post
set
  locale = coalesce(
    case
      when post.locale_codes[1] in ('bg', 'ru', 'ua', 'en') then post.locale_codes[1]
      else null
    end,
    settings.default_locale,
    'ru'
  ),
  meta_description = case
    when btrim(post.meta_description) = '' then post.excerpt
    else post.meta_description
  end,
  og_title = case
    when btrim(post.og_title) = '' then coalesce(nullif(post.seo_title, ''), post.title)
    else post.og_title
  end,
  og_description = case
    when btrim(post.og_description) = '' then post.excerpt
    else post.og_description
  end,
  published_at = case
    when post.status = 'published' and post.published_at is null
      then coalesce(
        post.published_on::timestamp at time zone coalesce(settings.timezone, 'Europe/Sofia'),
        post.created_at
      )
    else post.published_at
  end,
  scheduled_for = case
    when post.status = 'scheduled'
      and post.scheduled_for is null
      and post.published_on is not null
      then post.published_on::timestamp at time zone coalesce(settings.timezone, 'Europe/Sofia')
    else post.scheduled_for
  end
from (select * from public.admin_site_settings where id = 'site') settings
where post.locale is null
   or btrim(post.meta_description) = ''
   or btrim(post.og_title) = ''
   or btrim(post.og_description) = ''
   or (post.status = 'published' and post.published_at is null)
   or (post.status = 'scheduled' and post.scheduled_for is null and post.published_on is not null);

-- The settings singleton may be absent in production clones; keep the backfill
-- deterministic without requiring a seed row.
update public.admin_blog_posts
set
  locale = coalesce(locale, 'ru'),
  meta_description = case when btrim(meta_description) = '' then excerpt else meta_description end,
  og_title = case when btrim(og_title) = '' then coalesce(nullif(seo_title, ''), title) else og_title end,
  og_description = case when btrim(og_description) = '' then excerpt else og_description end,
  published_at = case
    when status = 'published' and published_at is null
      then coalesce(published_on::timestamp at time zone 'Europe/Sofia', created_at)
    else published_at
  end,
  scheduled_for = case
    when status = 'scheduled' and scheduled_for is null and published_on is not null
      then published_on::timestamp at time zone 'Europe/Sofia'
    else scheduled_for
  end
where locale is null
   or btrim(meta_description) = ''
   or btrim(og_title) = ''
   or btrim(og_description) = ''
   or (status = 'published' and published_at is null)
   or (status = 'scheduled' and scheduled_for is null and published_on is not null);

update public.admin_blog_posts post
set cover_media_id = media.id
from public.admin_media_assets media
where post.cover_media_id is null
  and nullif(post.cover_image_url, '') is not null
  and media.url = post.cover_image_url;

update public.admin_blog_posts
set og_image_media_id = cover_media_id
where og_image_media_id is null
  and cover_media_id is not null;

alter table public.admin_blog_posts
  alter column locale set default 'ru',
  alter column locale set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_editor_json_object_check'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_editor_json_object_check
      check (jsonb_typeof(editor_json) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_hreflang_object_check'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_hreflang_object_check
      check (jsonb_typeof(hreflang) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_locale_check'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_locale_check
      check (locale in ('bg', 'ru', 'ua', 'en'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_robots_directives_check'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_robots_directives_check
      check (btrim(robots_directives) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_publication_window_check'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_publication_window_check
      check (unpublished_at is null or published_at is null or unpublished_at > published_at);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_published_at_check'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_published_at_check
      check (status <> 'published' or published_at is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_cover_media_id_fkey'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_cover_media_id_fkey
      foreign key (cover_media_id)
      references public.admin_media_assets(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_blog_posts'::regclass
      and conname = 'admin_blog_posts_og_image_media_id_fkey'
  ) then
    alter table public.admin_blog_posts
      add constraint admin_blog_posts_og_image_media_id_fkey
      foreign key (og_image_media_id)
      references public.admin_media_assets(id)
      on update cascade
      on delete set null;
  end if;
end
$$;

comment on column public.admin_blog_posts.editor_json is
  'Canonical editor document. A later content import must convert legacy body text into the selected editor schema.';
comment on column public.admin_blog_posts.sanitized_html is
  'Server-sanitized render output only. Legacy body is intentionally not copied because it has not passed the sanitizer.';
comment on column public.admin_blog_posts.hreflang is
  'Verified locale-to-canonical-URL map. A later content import must populate real alternates.';
comment on column public.admin_blog_posts.scheduled_for is
  'Scheduled rows without a trustworthy legacy date remain null and inert until an editor chooses a timestamp.';

alter table public.admin_site_settings
  add column if not exists gift_certificates_enabled boolean not null default true;

update public.admin_site_settings
set gift_certificates_enabled = true
where gift_certificates_enabled is null;

alter table public.admin_appointments
  add column if not exists post_visit_comment text not null default '',
  add column if not exists post_visit_commented_at timestamptz,
  add column if not exists post_visit_commented_by uuid,
  add column if not exists updated_by uuid,
  add column if not exists version integer not null default 1,
  add column if not exists overlap_override boolean not null default false,
  add column if not exists overlap_override_reason text not null default '',
  add column if not exists overlap_overridden_at timestamptz,
  add column if not exists overlap_overridden_by uuid;

update public.admin_appointments
set post_visit_commented_at = coalesce(post_visit_commented_at, updated_at)
where btrim(post_visit_comment) <> ''
  and post_visit_commented_at is null;

-- Preserve pre-existing active overlaps by explicitly marking the later row.
-- No appointment is deleted or rescheduled by this migration.
with active_overlaps as (
  select later.id
  from public.admin_appointments later
  where later.status in ('confirmed', 'pending', 'request')
    and not later.overlap_override
    and exists (
      select 1
      from public.admin_appointments earlier
      where earlier.id <> later.id
        and earlier.status in ('confirmed', 'pending', 'request')
        and not earlier.overlap_override
        and (earlier.starts_on + earlier.starts_at, earlier.id)
          < (later.starts_on + later.starts_at, later.id)
        and tsrange(
          earlier.starts_on + earlier.starts_at,
          earlier.starts_on + earlier.starts_at
            + make_interval(mins => earlier.duration_minutes + earlier.buffer_minutes),
          '[)'
        ) && tsrange(
          later.starts_on + later.starts_at,
          later.starts_on + later.starts_at
            + make_interval(mins => later.duration_minutes + later.buffer_minutes),
          '[)'
        )
    )
)
update public.admin_appointments appointment
set
  overlap_override = true,
  overlap_override_reason = 'Backfilled: overlapping active appointment existed before overlap enforcement.',
  overlap_overridden_at = coalesce(appointment.overlap_overridden_at, now())
from active_overlaps overlap
where appointment.id = overlap.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_post_visit_comment_check'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_post_visit_comment_check
      check (btrim(post_visit_comment) = '' or post_visit_commented_at is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_version_check'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_version_check
      check (version > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_overlap_override_check'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_overlap_override_check
      check (
        (
          not overlap_override
          and btrim(overlap_override_reason) = ''
          and overlap_overridden_at is null
          and overlap_overridden_by is null
        )
        or (
          overlap_override
          and btrim(overlap_override_reason) <> ''
          and overlap_overridden_at is not null
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_post_visit_commented_by_fkey'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_post_visit_commented_by_fkey
      foreign key (post_visit_commented_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_updated_by_fkey'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_updated_by_fkey
      foreign key (updated_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_overlap_overridden_by_fkey'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_overlap_overridden_by_fkey
      foreign key (overlap_overridden_by) references auth.users(id) on delete set null;
  end if;
end
$$;

insert into public.admin_audit_log (
  actor_user_id,
  action,
  entity_table,
  entity_id,
  metadata
)
select
  null,
  'appointment.overlap_override_backfilled',
  'admin_appointments',
  appointment.id,
  jsonb_build_object(
    'source', '20260714100000_admin_content_calendar_completion',
    'starts_on', appointment.starts_on,
    'starts_at', appointment.starts_at,
    'duration_minutes', appointment.duration_minutes,
    'buffer_minutes', appointment.buffer_minutes,
    'reason', appointment.overlap_override_reason
  )
from public.admin_appointments appointment
where appointment.overlap_override
  and appointment.overlap_override_reason =
    'Backfilled: overlapping active appointment existed before overlap enforcement.'
  and not exists (
    select 1
    from public.admin_audit_log audit
    where audit.action = 'appointment.overlap_override_backfilled'
      and audit.entity_table = 'admin_appointments'
      and audit.entity_id = appointment.id
      and audit.metadata ->> 'source' =
        '20260714100000_admin_content_calendar_completion'
  );

create or replace function public.admin_prepare_appointment_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  override_changed boolean;
begin
  if tg_op = 'INSERT' then
    new.version := greatest(coalesce(new.version, 1), 1);
    new.updated_at := coalesce(new.updated_at, now());
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.created_by);
    override_changed := new.overlap_override;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by, old.updated_by);
    override_changed := new.overlap_override
      and (
        not old.overlap_override
        or new.overlap_override_reason is distinct from old.overlap_override_reason
      );
  end if;

  if override_changed then
    if not public.admin_can_manage_operations()
      and current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception using
        errcode = '42501',
        message = 'Only owner or administrator roles may authorize appointment overlaps.';
    end if;

    if btrim(new.overlap_override_reason) = '' then
      raise exception using
        errcode = '23514',
        message = 'An overlap override reason is required.';
    end if;

    new.overlap_overridden_at := now();
    new.overlap_overridden_by := coalesce(auth.uid(), new.overlap_overridden_by);
  elsif not new.overlap_override then
    new.overlap_override_reason := '';
    new.overlap_overridden_at := null;
    new.overlap_overridden_by := null;
  end if;

  if btrim(new.post_visit_comment) <> ''
    and (
      tg_op = 'INSERT'
      or new.post_visit_comment is distinct from old.post_visit_comment
    ) then
    new.post_visit_commented_at := now();
    new.post_visit_commented_by := coalesce(auth.uid(), new.post_visit_commented_by);
  elsif btrim(new.post_visit_comment) = '' then
    new.post_visit_commented_at := null;
    new.post_visit_commented_by := null;
  end if;

  return new;
end;
$$;

revoke all on function public.admin_prepare_appointment_write() from public;

drop trigger if exists admin_appointments_prepare_write on public.admin_appointments;
create trigger admin_appointments_prepare_write
before insert or update on public.admin_appointments
for each row execute function public.admin_prepare_appointment_write();

create or replace function public.admin_audit_appointment_overlap_override()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' and new.overlap_override then
    audit_action := 'appointment.overlap_override_enabled';
  elsif tg_op = 'UPDATE'
    and new.overlap_override is distinct from old.overlap_override then
    audit_action := case
      when new.overlap_override then 'appointment.overlap_override_enabled'
      else 'appointment.overlap_override_disabled'
    end;
  elsif tg_op = 'UPDATE'
    and new.overlap_override
    and new.overlap_override_reason is distinct from old.overlap_override_reason then
    audit_action := 'appointment.overlap_override_updated';
  else
    return new;
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  values (
    coalesce(new.overlap_overridden_by, auth.uid()),
    audit_action,
    'admin_appointments',
    new.id,
    jsonb_build_object(
      'starts_on', new.starts_on,
      'starts_at', new.starts_at,
      'duration_minutes', new.duration_minutes,
      'buffer_minutes', new.buffer_minutes,
      'reason', new.overlap_override_reason
    )
  );

  return new;
end;
$$;

revoke all on function public.admin_audit_appointment_overlap_override() from public;

drop trigger if exists admin_appointments_audit_overlap_override on public.admin_appointments;
create trigger admin_appointments_audit_overlap_override
after insert or update on public.admin_appointments
for each row execute function public.admin_audit_appointment_overlap_override();

-- Replace the foundation's exact-start uniqueness with an overlap-aware rule.
-- Rows carrying an authorized override are deliberately outside the exclusion.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.admin_appointments'::regclass
      and constraint_row.contype = 'u'
      and (
        select array_agg(attribute.attname order by key_column.ordinality)
        from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute attribute
          on attribute.attrelid = constraint_row.conrelid
         and attribute.attnum = key_column.attnum
      ) = array['starts_on', 'starts_at']::name[]
  loop
    execute format(
      'alter table public.admin_appointments drop constraint %I',
      constraint_name
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_appointments'::regclass
      and conname = 'admin_appointments_active_schedule_excl'
  ) then
    alter table public.admin_appointments
      add constraint admin_appointments_active_schedule_excl
      exclude using gist (
        (
          tsrange(
            starts_on + starts_at,
            starts_on + starts_at + make_interval(mins => duration_minutes + buffer_minutes),
            '[)'
          )
        ) with &&
      )
      where (
        status in ('confirmed', 'pending', 'request')
        and not overlap_override
      );
  end if;
end
$$;

create index if not exists admin_services_cover_media_idx
  on public.admin_services (cover_media_id)
  where cover_media_id is not null;
create index if not exists admin_service_translations_locale_status_idx
  on public.admin_service_translations (locale, status, service_slug);
create index if not exists admin_service_translations_og_media_idx
  on public.admin_service_translations (og_image_media_id)
  where og_image_media_id is not null;
create unique index if not exists admin_media_placements_key_locale_uidx
  on public.admin_media_placements (placement_key, coalesce(locale, '*'));
create index if not exists admin_media_placements_page_slot_idx
  on public.admin_media_placements (page_key, slot_key, locale, is_published, sort_order);
create index if not exists admin_media_placements_asset_idx
  on public.admin_media_placements (media_asset_id);
create index if not exists admin_blog_posts_locale_publication_idx
  on public.admin_blog_posts (locale, status, published_at, unpublished_at);
create index if not exists admin_blog_posts_cover_media_idx
  on public.admin_blog_posts (cover_media_id)
  where cover_media_id is not null;
create index if not exists admin_blog_posts_og_media_idx
  on public.admin_blog_posts (og_image_media_id)
  where og_image_media_id is not null;
create index if not exists admin_appointments_schedule_lookup_idx
  on public.admin_appointments (starts_on, starts_at, status)
  include (duration_minutes, buffer_minutes, overlap_override);
create index if not exists admin_appointments_overlap_override_idx
  on public.admin_appointments (overlap_overridden_at, overlap_overridden_by)
  where overlap_override;
create index if not exists admin_appointments_updated_by_idx
  on public.admin_appointments (updated_by, updated_at)
  where updated_by is not null;

alter table public.admin_service_translations enable row level security;
alter table public.admin_media_placements enable row level security;

grant select, insert, update, delete on public.admin_service_translations to authenticated, service_role;
grant select, insert, update, delete on public.admin_media_placements to authenticated, service_role;
grant select, insert, update, delete on public.admin_services to service_role;
grant select, insert, update, delete on public.admin_media_assets to service_role;
grant select, insert, update, delete on public.admin_blog_posts to service_role;
grant select, insert, update, delete on public.admin_site_settings to service_role;
grant select, insert, update, delete on public.admin_appointments to service_role;

drop policy if exists "content roles can read service translations" on public.admin_service_translations;
create policy "content roles can read service translations"
on public.admin_service_translations
for select
to authenticated
using (public.admin_can_read_content());

drop policy if exists "editor roles can manage service translations" on public.admin_service_translations;
create policy "editor roles can manage service translations"
on public.admin_service_translations
for all
to authenticated
using (public.admin_can_manage_content())
with check (public.admin_can_manage_content());

drop policy if exists "content roles can read media placements" on public.admin_media_placements;
create policy "content roles can read media placements"
on public.admin_media_placements
for select
to authenticated
using (public.admin_can_read_content());

drop policy if exists "editor roles can manage media placements" on public.admin_media_placements;
create policy "editor roles can manage media placements"
on public.admin_media_placements
for all
to authenticated
using (public.admin_can_manage_content())
with check (public.admin_can_manage_content());

drop policy if exists "public can read published services" on public.admin_services;
create policy "public can read published services"
on public.admin_services
for select
to anon
using (status = 'published');

drop policy if exists "public can read published service translations" on public.admin_service_translations;
create policy "public can read published service translations"
on public.admin_service_translations
for select
to anon
using (
  status = 'published'
  and btrim(title) <> ''
  and btrim(short_description) <> ''
  and btrim(body) <> ''
  and exists (
    select 1
    from public.admin_services service
    where service.slug = admin_service_translations.service_slug
      and service.status = 'published'
  )
);

drop policy if exists "public can read published media placements" on public.admin_media_placements;
create policy "public can read published media placements"
on public.admin_media_placements
for select
to anon
using (is_published);

drop policy if exists "public can read referenced ready media" on public.admin_media_assets;
create policy "public can read referenced ready media"
on public.admin_media_assets
for select
to anon
using (
  status = 'ready'
  and (
    exists (
      select 1
      from public.admin_media_placements placement
      where placement.media_asset_id = admin_media_assets.id
        and placement.is_published
    )
    or exists (
      select 1
      from public.admin_services service
      where service.cover_media_id = admin_media_assets.id
        and service.status = 'published'
    )
    or exists (
      select 1
      from public.admin_service_translations translation
      join public.admin_services service on service.slug = translation.service_slug
      where translation.og_image_media_id = admin_media_assets.id
        and translation.status = 'published'
        and service.status = 'published'
    )
    or exists (
      select 1
      from public.admin_blog_posts post
      where admin_media_assets.id in (post.cover_media_id, post.og_image_media_id)
        and post.status = 'published'
        and post.published_at <= now()
        and (post.unpublished_at is null or post.unpublished_at > now())
        and btrim(post.sanitized_html) <> ''
    )
  )
);

drop policy if exists "public can read published blog posts" on public.admin_blog_posts;
create policy "public can read published blog posts"
on public.admin_blog_posts
for select
to anon
using (
  status = 'published'
  and published_at <= now()
  and (unpublished_at is null or unpublished_at > now())
  and btrim(sanitized_html) <> ''
);

drop policy if exists "public can read gift certificate flag" on public.admin_site_settings;
create policy "public can read gift certificate flag"
on public.admin_site_settings
for select
to anon
using (id = 'site');

-- Anon receives only the columns required by the security-invoker views. This
-- avoids exposing editor documents, legacy body text, or internal settings.
grant select (
  slug,
  category,
  status,
  default_duration_minutes,
  cover_media_id,
  display_order,
  updated_at
) on public.admin_services to anon;

grant select (
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
  og_image_media_id,
  updated_at
) on public.admin_service_translations to anon;

grant select (
  id,
  media_asset_id,
  placement_key,
  page_key,
  slot_key,
  locale,
  is_published,
  sort_order,
  caption_localized,
  updated_at
) on public.admin_media_placements to anon;

grant select (
  id,
  url,
  status,
  mime_type,
  byte_size,
  width_pixels,
  height_pixels,
  alt_text,
  alt_text_localized,
  updated_at
) on public.admin_media_assets to anon;

grant select (
  id,
  slug,
  title,
  category,
  status,
  author,
  tag_labels,
  sanitized_html,
  canonical_url,
  meta_description,
  robots_directives,
  og_title,
  og_description,
  cover_media_id,
  og_image_media_id,
  locale,
  hreflang,
  published_at,
  unpublished_at,
  updated_at
) on public.admin_blog_posts to anon;

grant select (id, gift_certificates_enabled)
on public.admin_site_settings to anon;

create or replace view public.admin_published_services
with (security_invoker = true, security_barrier = true)
as
select
  service.slug,
  service.category,
  service.default_duration_minutes,
  service.cover_media_id,
  service.display_order,
  service.updated_at
from public.admin_services service
where service.status = 'published';

create or replace view public.admin_published_service_translations
with (security_invoker = true, security_barrier = true)
as
select
  translation.service_slug,
  translation.locale,
  translation.title,
  translation.short_description,
  translation.body,
  translation.seo_title,
  translation.seo_description,
  translation.canonical_url,
  translation.robots_directives,
  translation.og_title,
  translation.og_description,
  translation.og_image_media_id,
  translation.updated_at
from public.admin_service_translations translation
join public.admin_services service on service.slug = translation.service_slug
where service.status = 'published'
  and translation.status = 'published'
  and btrim(translation.title) <> ''
  and btrim(translation.short_description) <> ''
  and btrim(translation.body) <> '';

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
  and media.status = 'ready';

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
  post.published_at,
  post.unpublished_at,
  post.updated_at
from public.admin_blog_posts post
where post.status = 'published'
  and post.published_at <= now()
  and (post.unpublished_at is null or post.unpublished_at > now())
  and btrim(post.sanitized_html) <> '';

create or replace view public.admin_public_site_flags
with (security_invoker = true, security_barrier = true)
as
select settings.id, settings.gift_certificates_enabled
from public.admin_site_settings settings
where settings.id = 'site';

revoke all on public.admin_published_services from public;
revoke all on public.admin_published_service_translations from public;
revoke all on public.admin_published_media_placements from public;
revoke all on public.admin_published_blog_posts from public;
revoke all on public.admin_public_site_flags from public;

grant select on public.admin_published_services to anon, authenticated, service_role;
grant select on public.admin_published_service_translations to anon, authenticated, service_role;
grant select on public.admin_published_media_placements to anon, authenticated, service_role;
grant select on public.admin_published_blog_posts to anon, authenticated, service_role;
grant select on public.admin_public_site_flags to anon, authenticated, service_role;
