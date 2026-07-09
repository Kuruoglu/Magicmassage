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
      "admin_stripe_sales",
      "admin_finance_export_audit",
      "admin_audit_log",
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
  });

  it("defines content policies for editor-managed services and prices", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.admin_can_manage_content()");
    expect(sql).toContain("create or replace function public.admin_can_read_content()");
    expect(sql).toContain('create policy "content roles can read admin services"');
    expect(sql).toContain('create policy "editor roles can manage admin services"');
    expect(sql).toContain('create policy "content roles can read admin price variants"');
    expect(sql).toContain('create policy "editor roles can manage admin price variants"');
    expect(sql).not.toContain('create policy "accountant can read admin services"');
    expect(sql).not.toContain('create policy "accountant can read admin price variants"');
  });

  it("seeds starter services before starter price variants so price FK writes work", () => {
    const sql = readMigration();

    expect(sql).toContain("insert into public.admin_services");
    expect(sql).toContain("insert into public.admin_price_variants");
    expect(sql.indexOf("insert into public.admin_services")).toBeLessThan(sql.indexOf("insert into public.admin_price_variants"));
    expect(sql).toContain("'classic-massage'");
    expect(sql).toContain("'price-classic-60'");
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
