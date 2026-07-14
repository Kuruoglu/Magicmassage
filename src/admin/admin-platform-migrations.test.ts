import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("admin platform completion migrations", () => {
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
});
