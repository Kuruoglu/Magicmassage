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
    expect(sql).toContain("certificate_code text references public.admin_certificates(code) on delete set null");
    expect(sql).toContain("downloaded_by uuid not null references auth.users(id) on delete restrict");
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
