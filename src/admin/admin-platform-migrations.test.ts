import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("admin platform completion migrations", () => {
  it("deletes CRM records transactionally with role, version, outbox, relation, and audit safeguards", () => {
    const sql = readMigration("20260719120000_admin_record_deletion.sql");

    expect(sql).toContain("function public.admin_delete_record_with_audit");
    expect(sql).toContain("profile.role in ('owner', 'administrator')");
    expect(sql).toContain("for update");
    expect(sql.indexOf("for update")).toBeLessThan(sql.indexOf("update public.email_notifications"));
    expect(sql).toContain("current_appointment_version <> p_expected_version");
    expect(sql).toContain("notification.status = 'processing'");
    expect(sql).toContain("appointment_email_delivery_in_progress");
    expect(sql).toContain("notification.status = 'pending'");
    expect(sql.indexOf("notification.status = 'pending'")).toBeLessThan(
      sql.indexOf("notification.status = 'processing'"),
    );
    expect(sql).toContain("lease_token = null");
    expect(sql).toContain("client_has_appointments");
    expect(sql).toContain("from public.admin_certificates certificate");
    expect(sql).toContain("'appointment.delete'");
    expect(sql).toContain("'client.delete'");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("adds normalized content, placements, post-visit comments, scheduling, and overlap protection", () => {
    const sql = readMigration("20260714100000_admin_content_calendar_completion.sql");

    expect(sql).toContain("create table if not exists public.admin_service_translations");
    expect(sql).toContain("create table if not exists public.admin_media_placements");
    expect(sql).toContain("add column if not exists post_visit_comment text");
    expect(sql).toContain("add column if not exists scheduled_for timestamptz");
    expect(sql).toContain("add column if not exists overlap_override boolean");
    expect(sql).toContain("admin_appointments_active_schedule_excl");
    expect(sql).toContain("admin_audit_appointment_overlap_override");
  });

  it("keeps the storage bucket private and browser writes behind server APIs", () => {
    const storageSql = readMigration("20260714110000_admin_media_storage.sql");
    const boundarySql = readMigration("20260714150000_admin_server_write_boundary.sql");

    expect(storageSql).toContain("'admin-media'");
    expect(storageSql).toContain("'admin-media',\n  'admin-media',\n  false,");
    expect(storageSql).not.toContain('create policy "public can read admin media"');
    expect(storageSql).not.toMatch(/to\s+anon/i);
    expect(boundarySql).toContain("set public = false");
    expect(boundarySql).toContain('drop policy if exists "public can read admin media"');
    expect(boundarySql).toContain("revoke insert, update, delete on public.admin_appointments from authenticated");
    expect(boundarySql).toContain("revoke insert, update, delete on public.admin_blog_posts from authenticated");
    expect(boundarySql).toContain('drop policy if exists "editor roles can manage admin blog posts"');
  });

  it("publishes scheduled content only after its exact instant and enforces media consent", () => {
    const sql = readMigration("20260714160000_public_scheduling_and_media_backfill.sql");

    expect(sql).toContain("add column if not exists publish_at timestamptz");
    expect(sql).toContain("publication_consent_status in ('granted', 'not_required')");
    expect(sql).toContain("placement.publish_at is null or placement.publish_at <= now()");
    expect(sql).toContain("post.status = 'scheduled' and post.scheduled_for <= now()");
    expect(sql).toContain("coalesce(post.published_at, post.scheduled_for) as published_at");
  });

  it("persists blog cover alt text and keeps public modification timestamps current", () => {
    const sql = readMigration("20260714190000_admin_content_integrity.sql");

    expect(sql).toContain("add column if not exists cover_alt_text text");
    expect(sql).toContain("create or replace function public.set_admin_updated_at()");
    expect(sql).toContain("'admin_media_placements'");
    expect(sql).toContain("post.cover_alt_text");
  });

  it("commits non-content records and media placements together with their audit rows", () => {
    const sql = readMigration("20260714220000_atomic_admin_record_writes.sql");

    expect(sql).toContain("function public.admin_save_record_with_audit");
    expect(sql).toContain("function public.admin_replace_media_placement_with_audit");
    expect(sql).toContain("insert into public.admin_audit_log");
    expect(sql).toContain("grant execute on function public.admin_save_record_with_audit");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("revoke all on function public.admin_save_record_with_audit");
  });

  it("publishes synchronized contact details and a validated footer schedule", () => {
    const sql = readMigration("20260718100000_public_business_contact_settings.sql");

    expect(sql).toContain("function public.admin_business_hours_are_valid");
    expect(sql).toContain("add column if not exists working_schedule jsonb");
    expect(sql).toContain("admin_contact_settings_public_fields_check");
    expect(sql).toContain("admin_contact_channels_reserved_identity_check");
    expect(sql).toContain("function public.admin_sync_primary_contact_channel");
    expect(sql).toContain("function public.admin_save_contact_settings_with_audit");
    expect(sql).toContain("create or replace view public.admin_public_business_details");
    expect(sql).toContain("with (security_invoker = false, security_barrier = true)");
    expect(sql).toContain("grant select on public.admin_public_business_details to anon, authenticated, service_role");
    expect(sql).toContain("grant execute on function public.admin_save_contact_settings_with_audit");
    expect(sql).toContain("to service_role");
  });

  it("gates localized blog content at the database boundary and seeds every locale", () => {
    const sql = readMigration("20260718120000_blog_visibility_and_localized_articles.sql");

    expect(sql).toContain("add column if not exists blog_enabled boolean not null default true");
    expect(sql).toContain("add column if not exists translation_key text");
    expect(sql).toContain("admin_blog_posts_translation_locale_unique");
    expect(sql).toContain("function public.public_blog_is_enabled()");
    expect(sql).toContain("public.public_blog_is_enabled()");
    expect(sql).toMatch(
      /post\.canonical_url,\s+post\.meta_description,\s+post\.robots_directives,\s+post\.og_title,\s+post\.og_description,\s+post\.cover_media_id,\s+post\.og_image_media_id,\s+post\.hreflang,/
    );
    expect(sql).not.toContain("jsonb_build_object(post.locale, post.cover_alt_text)");
    expect(sql).toContain("grant select (cover_alt_text, translation_key)");
    expect(sql).toContain("function public.admin_set_blog_visibility_with_audit");
    expect(sql).toContain("'site.blog_visibility'");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");

    const localizedSeedIds = sql.match(/\$blog\$blog-(?:choose-massage-burgas|first-massage-preparation|desk-workday-recovery)-(?:bg|ru|ua|en)\$blog\$/g) ?? [];
    expect(new Set(localizedSeedIds).size).toBe(12);
  });

  it("saves one localized row inside an immutable audited article group", () => {
    const sql = readMigration("20260718130000_admin_localized_blog_editor.sql");

    expect(sql).toContain("function public.admin_save_localized_blog_post_aggregate");
    expect(sql).toContain("post_translation_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$'");
    expect(sql).toContain("jsonb_array_length(p_post -> 'locale_codes') <> 1");
    expect(sql).toContain("profile.status = 'active'");
    expect(sql).toContain("actor_role not in ('owner', 'administrator', 'editor')");
    expect(sql).toContain("for update");
    expect(sql).toContain("blog_translation_key_immutable");
    expect(sql).toContain("blog_translation_locale_conflict");
    expect(sql).toContain("blog_locale_slug_conflict");
    expect(sql).toContain("perform public.admin_save_blog_post_aggregate");
    expect(sql).toContain("'translationKey', post_translation_key");
    expect(sql).toContain("set translation_key = post_translation_key");
    expect(sql).toContain("jsonb_object_agg(post.locale, post.canonical_url order by post.locale)");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });

  it("serializes localized article writes before rebuilding hreflang", () => {
    const sql = readMigration("20260718140000_serialize_localized_blog_hreflang.sql");

    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(post_translation_key, 0))");
    expect(sql).toContain("jsonb_object_agg(post.locale, post.canonical_url order by post.locale)");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
