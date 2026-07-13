import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260709120000_admin_foundation.sql");

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

describe("admin Supabase schema foundation", () => {
  it("creates the core admin tables with RLS enabled", () => {
    const sql = readMigration();
    const tables = [
      "admin_profiles",
      "admin_clients",
      "admin_appointments",
      "admin_certificates",
      "admin_services",
      "admin_price_variants",
      "admin_media_assets",
      "admin_contact_channels",
      "admin_contact_settings",
      "admin_blog_posts",
      "admin_site_settings",
      "admin_stripe_sales",
      "admin_finance_export_audit",
      "admin_audit_log",
      "gift_certificate_orders",
      "gift_certificate_fulfillment_locks",
    ];

    expect(sql).toContain("create type public.admin_role as enum");

    for (const table of tables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("uses backend-ready foreign keys that match the admin domain records", () => {
    const sql = readMigration();

    expect(sql).toContain("client_id text not null references public.admin_clients(id) on delete restrict");
    expect(sql).toContain("client_id text references public.admin_clients(id) on delete set null");
    expect(sql).toContain("service_slug text not null references public.admin_services(slug) on update cascade on delete restrict");
    expect(sql).toContain("certificate_code text references public.admin_certificates(code) on delete set null");
    expect(sql).toContain("downloaded_by uuid not null references auth.users(id) on delete restrict");
    expect(sql).toContain("payment_intent_id text primary key");
    expect(sql).toContain("gift_order_id uuid references public.gift_certificate_orders(id) on delete set null");
  });

  it("defines gift certificate payment order and fulfillment lock tables", () => {
    const sql = readMigration();

    expect(sql).toContain("payment_intent_id text unique");
    expect(sql).toContain("certificate_code text not null unique");
    expect(sql).toContain("status text not null default 'pending'");
    expect(sql).toContain("fulfillment_attempts integer not null default 0");
    expect(sql).toContain("status text not null default 'claimed'");
    expect(sql).toContain("check (status in ('claimed', 'succeeded', 'failed', 'dead_letter'))");
  });

  it("defines content policies for editor-managed website content tables", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.admin_can_manage_content()");
    expect(sql).toContain("create or replace function public.admin_can_read_content()");
    expect(sql).toContain('create policy "content roles can read admin services"');
    expect(sql).toContain('create policy "editor roles can manage admin services"');
    expect(sql).toContain('create policy "content roles can read admin price variants"');
    expect(sql).toContain('create policy "editor roles can manage admin price variants"');
    expect(sql).toContain('create policy "content roles can read admin media assets"');
    expect(sql).toContain('create policy "editor roles can manage admin media assets"');
    expect(sql).toContain('create policy "content roles can read admin contact channels"');
    expect(sql).toContain('create policy "editor roles can manage admin contact channels"');
    expect(sql).toContain('create policy "content roles can read admin contact settings"');
    expect(sql).toContain('create policy "editor roles can manage admin contact settings"');
    expect(sql).toContain('create policy "content roles can read admin blog posts"');
    expect(sql).toContain('create policy "editor roles can manage admin blog posts"');
    expect(sql).not.toContain('create policy "accountant can read admin services"');
    expect(sql).not.toContain('create policy "accountant can read admin price variants"');
    expect(sql).not.toContain('create policy "accountant can read admin media assets"');
    expect(sql).not.toContain('create policy "accountant can read admin contact channels"');
    expect(sql).not.toContain('create policy "accountant can read admin contact settings"');
    expect(sql).not.toContain('create policy "accountant can read admin blog posts"');
  });

  it("keeps site settings owner-only and outside accountant/content access", () => {
    const sql = readMigration();

    expect(sql).toContain('create policy "owner can read admin site settings"');
    expect(sql).toContain('create policy "owner can manage admin site settings"');
    expect(sql).not.toContain('create policy "content roles can read admin site settings"');
    expect(sql).not.toContain('create policy "editor roles can manage admin site settings"');
    expect(sql).not.toContain('create policy "accountant can read admin site settings"');
  });

  it("seeds starter services before starter price variants and website content rows", () => {
    const sql = readMigration();

    expect(sql).toContain("insert into public.admin_services");
    expect(sql).toContain("insert into public.admin_price_variants");
    expect(sql).toContain("insert into public.admin_media_assets");
    expect(sql).toContain("insert into public.admin_contact_settings");
    expect(sql).toContain("insert into public.admin_contact_channels");
    expect(sql).toContain("insert into public.admin_blog_posts");
    expect(sql).toContain("insert into public.admin_site_settings");
    expect(sql.indexOf("insert into public.admin_services")).toBeLessThan(sql.indexOf("insert into public.admin_price_variants"));
    expect(sql).toContain("'classic-massage'");
    expect(sql).toContain("'price-classic-60'");
    expect(sql).toContain("'media-classic-cover'");
    expect(sql).toContain("'contact-phone'");
    expect(sql).toContain("'blog-first-massage-preparation'");
    expect(sql).toContain("'site',");
  });

  it("defines role helpers and policies that keep accountant access finance-only", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.admin_has_role(required_roles public.admin_role[])");
    expect(sql).toContain("security definer");
    expect(sql).toContain("(select auth.uid())");
    expect(sql).toContain('create policy "accountant can read stripe sales"');
    expect(sql).toContain('create policy "accountant can log finance exports"');
    expect(sql).not.toContain('create policy "accountant can read admin clients"');
    expect(sql).not.toContain('create policy "accountant can read appointments"');
  });
});
