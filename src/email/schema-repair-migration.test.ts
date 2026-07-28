import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const emailMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260719100000_transactional_email_outbox.sql",
  ),
  "utf8",
);
const giftMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260719110000_gift_certificate_email_outbox.sql",
  ),
  "utf8",
);
const repairMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728230000_repair_transactional_email_schema_drift.sql",
  ),
  "utf8",
);

const repairedEmailFunctions = [
  "email_claim_notifications",
  "email_prepare_claimed_notification",
  "email_cancel_notification",
  "email_record_webhook_event",
  "public_booking_confirm_session_v5",
  "email_unsubscribe_care_by_notification",
  "email_enqueue_appointment_transition_impl",
  "admin_save_record_with_audit",
] as const;

const repairedGiftFunctions = [
  "gift_claim_abandoned_pending_orders",
  "gift_redact_abandoned_pending_order",
] as const;

function functionBody(sql: string, name: string) {
  const startPattern = new RegExp(
    `^create(?: or replace)? function public\\.${name}\\s*\\(`,
    "mi",
  );
  const start = sql.search(startPattern);
  const bodyStart = sql.indexOf("as $$", start);
  const bodyEnd = sql.indexOf("$$;", bodyStart + 5);

  expect(start, `${name} declaration`).toBeGreaterThanOrEqual(0);
  expect(bodyStart, `${name} body start`).toBeGreaterThan(start);
  expect(bodyEnd, `${name} body end`).toBeGreaterThan(bodyStart);

  return sql.slice(bodyStart + 5, bodyEnd).trim().replaceAll("\r\n", "\n");
}

describe("transactional email schema repair migration", () => {
  it("restores the consent hash column and address-bound consent constraint", () => {
    expect(repairMigration).toContain(
      "add column if not exists care_email_consent_email_hash text",
    );
    expect(repairMigration).toContain(
      "set care_email_consent_email_hash = public.email_address_hash(email)",
    );
    expect(repairMigration).toContain(
      "care_email_consent_email_hash ~ '^[a-f0-9]{64}$'",
    );
    expect(repairMigration).toContain(
      "drop constraint if exists admin_clients_care_email_consent_shape_check",
    );
  });

  it("copies every drifted email function from the canonical migration", () => {
    for (const name of repairedEmailFunctions) {
      expect(functionBody(repairMigration, name)).toBe(
        functionBody(emailMigration, name),
      );
      expect(repairMigration).toContain(
        `create or replace function public.${name}`,
      );
    }
  });

  it("restores both missing gift cleanup functions from the canonical migration", () => {
    for (const name of repairedGiftFunctions) {
      expect(functionBody(repairMigration, name)).toBe(
        functionBody(giftMigration, name),
      );
      expect(repairMigration).toContain(
        `create or replace function public.${name}`,
      );
    }
  });

  it("reapplies least-privilege grants without replaying the original schema", () => {
    expect(repairMigration).toContain(
      "from public, anon, authenticated, service_role",
    );
    for (const name of [
      ...repairedEmailFunctions.filter(
        (value) => value !== "email_enqueue_appointment_transition_impl",
      ),
      ...repairedGiftFunctions,
    ]) {
      expect(repairMigration).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\(`),
      );
    }

    expect(repairMigration).not.toContain("create table public.");
    expect(repairMigration).not.toContain("drop table");
    expect(repairMigration).not.toContain("email_install_worker_cron()");
  });

  it("recreates only the API function whose return type changed", () => {
    expect(repairMigration).toContain(
      "drop function if exists public.admin_save_record_with_audit(",
    );
    expect(repairMigration.match(/drop function if exists public\./g)).toHaveLength(1);
  });
});
