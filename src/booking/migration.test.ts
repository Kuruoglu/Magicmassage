import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715100000_public_booking.sql",
);
const bufferSnapshotMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715110000_public_booking_hold_buffer_snapshot.sql",
);
const holdPriceAndContactMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715120000_public_booking_hold_price_and_contact.sql",
);
const adminBookingIntegrityMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715130000_admin_booking_integrity.sql",
);
const publicBookingHardeningMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715140000_public_booking_hardening.sql",
);
const bookingConflictClassificationMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715150000_admin_booking_conflict_classification.sql",
);
const bookingDomainErrorCodeMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715160000_admin_booking_domain_error_codes.sql",
);
const adminPublicDurationMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715280000_allow_admin_public_appointment_duration.sql",
);
const bookingSessionHoldMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715170000_public_booking_session_holds.sql",
);
const bookingHoldRestoreMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715180000_public_booking_hold_restore.sql",
);
const bookingSessionConfirmationMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715190000_public_booking_session_confirmation.sql",
);
const confirmedSessionRetentionMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715200000_public_booking_confirmed_session_retention.sql",
);
const holdSelectionVersionMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715210000_public_booking_hold_selection_version.sql",
);
const holdSelectionIdentityMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715220000_public_booking_hold_selection_identity.sql",
);
const bookingQuoteAndConfirmationRestoreMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715230000_public_booking_quote_and_confirmation_restore.sql",
);
const confirmationRestoreIndexMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715240000_public_booking_confirmation_restore_index.sql",
);
const halfHourGridMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715250000_public_booking_half_hour_grid.sql",
);
const expireQuarterHourHoldsMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715260000_expire_quarter_hour_booking_holds.sql",
);
const backToBackAdminAppointmentsMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260715270000_allow_back_to_back_admin_appointments.sql",
);
const multiSpecialistSecurityMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260716100000_multi_specialist_access_security.sql",
);
const adminMfaTrackingMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716120000_track_admin_mfa_login.sql",
);
const lastOwnerProtectionMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716130000_protect_last_admin_owner.sql",
);
const specialistOffboardingMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716140000_harden_specialist_offboarding.sql",
);
const multiSpecialistHardeningMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716150000_harden_multi_specialist_security.sql",
);
const specialistChoiceMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716170000_specialist_choice_and_contact_lockdown.sql",
);
const specialistAppointmentLockMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716180000_lock_specialist_appointment_mutations.sql",
);
const contactRevealLimitsMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716190000_restore_owner_contact_reveal_limits.sql",
);
const publicSpecialistSlugsMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260716200000_public_specialist_slugs.sql",
);

function migrationSql() {
  return readFileSync(migrationPath, "utf8");
}

describe("public booking migration", () => {
  it("defines the stable calendar block contract and audited service-role mutation RPC", () => {
    const sql = migrationSql();

    expect(sql).toContain("create table if not exists public.admin_calendar_blocks");
    expect(sql).toContain("check (starts_at < ends_at)");
    expect(sql).toContain("create or replace function public.admin_mutate_calendar_block");
    expect(sql).toContain("calendar_block.create");
    expect(sql).toContain("calendar_block.update");
    expect(sql).toContain("calendar_block.delete");
    expect(sql).toContain("calendar_block_conflict");
    expect(sql).toContain("grant execute on function public.admin_mutate_calendar_block");
    expect(sql).toContain("to service_role");
  });

  it("caps only public availability at the configured value up to eight", () => {
    const sql = migrationSql();
    const blockRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_mutate_calendar_block"),
      sql.indexOf("create or replace function public.admin_save_booking_settings_with_audit"),
    );

    expect(sql).toContain("public_booking_daily_limit integer not null default 8");
    expect(sql).toContain("check (public_booking_daily_limit between 1 and 8)");
    expect(sql).toContain("when booking_buffer_minutes in (15, 30) then booking_buffer_minutes");
    expect(sql).toContain("candidate.daily_count >= settings.public_booking_daily_limit");
    expect(sql).toContain(") >= settings.public_booking_daily_limit then");
    expect(blockRpc).not.toContain("public_booking_daily_limit");
  });

  it("keeps private booking data and RPCs unavailable to anon", () => {
    const sql = migrationSql();

    expect(sql).toMatch(
      /create or replace view public\.admin_public_site_flags[\s\S]*settings\.public_booking_enabled/,
    );
    expect(sql).toContain(
      "revoke select (id, gift_certificates_enabled, public_booking_enabled)",
    );
    expect(sql).toContain(
      "grant select on public.admin_public_site_flags to anon, authenticated, service_role",
    );
    expect(sql).toContain("revoke all on public.admin_clients from anon");
    expect(sql).toContain("revoke all on public.admin_appointments from anon");
    expect(sql).toContain("revoke all on public.admin_site_settings from anon");
    expect(sql).toContain("revoke all on public.public_booking_holds from anon, authenticated");
    expect(sql).toContain("revoke all on function public.public_booking_confirm");
  });

  it("saves the full booking settings singleton with owner or administrator audit", () => {
    const sql = migrationSql();

    expect(sql).toContain("create or replace function public.admin_save_booking_settings_with_audit");
    expect(sql).toContain("profile.role::text in ('owner', 'administrator')");
    expect(sql).toContain("public_booking_daily_limit = (p_settings ->> 'public_booking_daily_limit')::integer");
    expect(sql).toContain("booking_hold_minutes = (p_settings ->> 'booking_hold_minutes')::integer");
    expect(sql).toContain("'site.booking_settings'");
    expect(sql).toContain("revoke all on function public.admin_save_booking_settings_with_audit(uuid, jsonb)");
    expect(sql).toContain("grant execute on function public.admin_save_booking_settings_with_audit(uuid, jsonb) to service_role");
  });

  it("rechecks holds, blocks, active appointments, and the exclusion constraint on confirmation", () => {
    const sql = migrationSql();
    const confirmRpc = sql.slice(
      sql.indexOf("create or replace function public.public_booking_confirm"),
      sql.indexOf("create or replace function public.public_booking_consume_rate_limit"),
    );

    expect(sql).toContain("where token_hash = p_token_hash\n  for update");
    expect(sql).toContain("from public.admin_calendar_blocks block");
    expect(sql).toContain("status in ('confirmed', 'pending', 'request')");
    expect(sql).toContain("status <> 'cancelled'");
    expect(sql).toContain("when exclusion_violation then");
    expect(sql).toContain("appointment.public_confirm");
    expect(confirmRpc).toContain("hold.buffer_minutes");
  });

  it("keeps the hold buffer snapshot valid after the owner changes the default", () => {
    const sql = readFileSync(bufferSnapshotMigrationPath, "utf8");

    expect(sql).toContain("create or replace function public.public_booking_confirm");
    expect(sql).toContain("p_token_hash text");
    expect(sql).not.toContain("hold.buffer_minutes <> settings.booking_buffer_minutes");
    expect(sql).toContain("hold.buffer_minutes");
  });

  it("snapshots price and stores the selected contact preference on confirmation", () => {
    const sql = readFileSync(holdPriceAndContactMigrationPath, "utf8");

    expect(sql).toContain("add column if not exists price_cents integer");
    expect(sql).toContain("add column if not exists currency text");
    expect(sql).toContain("variant.price_cents");
    expect(sql).toContain("hold.price_cents");
    expect(sql).toContain("p_contact_preference text");
    expect(sql).toContain("preferred_contact = excluded.preferred_contact");
    expect(sql).not.toContain("hold.buffer_minutes <> settings.booking_buffer_minutes");
  });

  it("keeps manual appointments unlimited while serializing them with public booking", () => {
    const sql = readFileSync(adminBookingIntegrityMigrationPath, "utf8");
    const appointmentRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_save_appointment_with_audit"),
      sql.indexOf("create or replace function public.admin_mutate_calendar_block"),
    );

    expect(appointmentRpc).toContain("pg_advisory_xact_lock");
    expect(appointmentRpc).toContain("appointment_calendar_block_conflict");
    expect(appointmentRpc).toContain("'admin'");
    expect(appointmentRpc).not.toContain("public_booking_daily_limit");
    expect(sql).toContain("public_appointment_immutable");
    expect(sql).toContain("current_appointment.origin = 'public'");
    expect(sql).toContain("grant execute on function public.admin_save_appointment_with_audit");
  });

  it("allows admins to adjust public appointment duration without unlocking other booking snapshots", () => {
    const sql = readFileSync(adminPublicDurationMigrationPath, "utf8");

    expect(sql).toContain("admin_prepare_appointment_write()");
    expect(sql).toContain("or new.duration_minutes is distinct from old.duration_minutes");
    expect(sql).toContain("effective_duration_minutes := requested_duration_minutes;");
    expect(sql).toContain("replace(prepare_definition, immutable_duration_clause, '')");
    expect(sql).toContain("elsif position('effective_duration_minutes := requested_duration_minutes;'");
  });

  it("counts active holds toward public capacity without limiting manual admin writes", () => {
    const sql = readFileSync(publicBookingHardeningMigrationPath, "utf8");
    const availabilityRpc = sql.slice(
      sql.indexOf("create or replace function public.public_booking_get_availability"),
      sql.indexOf("create or replace function public.public_booking_create_hold"),
    );
    const holdRpc = sql.slice(
      sql.indexOf("create or replace function public.public_booking_create_hold"),
      sql.indexOf("create or replace function public.public_booking_confirm"),
    );
    const appointmentRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_save_appointment_with_audit"),
      sql.indexOf("revoke all on function public.admin_mutate_calendar_block"),
    );

    expect(availabilityRpc).toContain("candidate.reserved_count >= settings.public_booking_daily_limit");
    expect(availabilityRpc).toContain("hold.status = 'active'");
    expect(holdRpc).toContain("active_hold.expires_at > now()");
    expect(appointmentRpc).toContain("appointment_public_hold_conflict");
    expect(appointmentRpc).not.toContain("public_booking_daily_limit");
  });

  it("uses optimistic versions and a consistent lock order for schedule mutations", () => {
    const sql = readFileSync(publicBookingHardeningMigrationPath, "utf8");
    const confirmRpc = sql.slice(
      sql.indexOf("create or replace function public.public_booking_confirm"),
      sql.indexOf("revoke all on function public.admin_prepare_appointment_write"),
    );

    expect(sql).toContain("requested_version <> current_appointment.version");
    expect(sql).toContain("p_expected_version integer");
    expect(sql).toContain("existing_block.version <> p_expected_version");
    expect(confirmRpc.indexOf("pg_advisory_xact_lock")).toBeLessThan(confirmRpc.indexOf("for update"));
  });

  it("keeps established CRM contact fields and snapshots the submitted booking contacts", () => {
    const sql = readFileSync(publicBookingHardeningMigrationPath, "utf8");
    const confirmRpc = sql.slice(
      sql.indexOf("create or replace function public.public_booking_confirm"),
      sql.indexOf("revoke all on function public.admin_prepare_appointment_write"),
    );
    const conflictClause = confirmRpc.slice(
      confirmRpc.indexOf("on conflict (phone_normalized) do update"),
      confirmRpc.indexOf("returning id into client_id"),
    );

    expect(conflictClause).toContain("gdpr_consent");
    expect(conflictClause).not.toContain("full_name =");
    expect(conflictClause).not.toContain("preferred_contact =");
    expect(confirmRpc).toContain("public_phone_snapshot");
    expect(confirmRpc).toContain("public_contact_preference_snapshot");
  });

  it("returns domain conflicts without triggering database serialization retries", () => {
    const hardeningSql = readFileSync(publicBookingHardeningMigrationPath, "utf8");
    const classificationSql = readFileSync(bookingConflictClassificationMigrationPath, "utf8");
    const compatibilitySql = readFileSync(bookingDomainErrorCodeMigrationPath, "utf8");

    expect(hardeningSql).not.toContain("raise exception using errcode = '40001'");
    expect(classificationSql).toContain("errcode = 'P0001', message = 'appointment_concurrent_update'");
    expect(classificationSql).toContain("errcode = 'P0001', message = 'appointment_public_hold_conflict'");
    expect(compatibilitySql).toContain("pg_get_functiondef");
    expect(compatibilitySql).toContain("'errcode = ''P0001'''\n");
  });

  it("permits only one active hold per opaque browser session", () => {
    const sql = readFileSync(bookingSessionHoldMigrationPath, "utf8");

    expect(sql).toContain("add column if not exists session_key_hash text");
    expect(sql).toContain("public_booking_holds_active_session_uidx");
    expect(sql).toContain("public-booking-session:");
    expect(sql).toContain("active_hold.id <> existing_session_hold.id");
    expect(sql).toContain("existing_hold.id <> existing_session_hold.id");
    expect(sql).toContain("new.session_key_hash := null");
    expect(sql).toContain("drop function if exists public.public_booking_create_hold");
    expect(sql).toContain("p_session_key_hash text");
  });

  it("restores an active hold through the verified browser session", () => {
    const sql = readFileSync(bookingHoldRestoreMigrationPath, "utf8");

    expect(sql).toContain("create function public.public_booking_restore_session_hold");
    expect(sql).toContain("public-booking-session:");
    expect(sql).toContain("set token_hash = p_token_hash");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("grant execute on function public.public_booking_restore_session_hold");
  });

  it("serializes confirmation with hold restoration through the signed session", () => {
    const sql = readFileSync(bookingSessionConfirmationMigrationPath, "utf8");

    expect(sql).toContain("create function public.public_booking_confirm_session");
    expect(sql).toContain("public-booking-session:");
    expect(sql).toContain("where hold.session_key_hash = p_session_key_hash");
    expect(sql).toContain("public.public_booking_confirm(");
    expect(sql).toContain("grant execute on function public.public_booking_confirm_session");
  });

  it("retains confirmed session hashes only for idempotent confirmation retries", () => {
    const sql = readFileSync(confirmedSessionRetentionMigrationPath, "utf8");

    expect(sql).toContain("where status = 'active' and session_key_hash is not null");
    expect(sql).toContain("if new.status = 'expired' then");
    expect(sql).toContain("status = 'confirmed'");
  });

  it("rejects confirmation from a tab that observed an older slot selection", () => {
    const sql = readFileSync(holdSelectionVersionMigrationPath, "utf8");

    expect(sql).toContain("add column if not exists selection_version integer");
    expect(sql).toContain("new.selection_version := old.selection_version + 1");
    expect(sql).toContain("create function public.public_booking_confirm_session_v2");
    expect(sql).toContain("current_selection_version is distinct from p_selection_version");
    expect(sql).toContain("message = 'slot_unavailable'");
    expect(sql).toContain("grant execute on function public.public_booking_confirm_session_v2");
  });

  it("pairs the version with the hold UUID across expired and recreated holds", () => {
    const sql = readFileSync(holdSelectionIdentityMigrationPath, "utf8");

    expect(sql).toContain("jsonb_build_object('selectionId', hold.id)");
    expect(sql).toContain("create function public.public_booking_confirm_session_v3");
    expect(sql).toContain("p_selection_id uuid");
    expect(sql).toContain("current_selection_id is distinct from p_selection_id");
    expect(sql).toContain("grant execute on function public.public_booking_confirm_session_v3");
  });

  it("returns the held quote and restores a committed confirmation by session", () => {
    const sql = readFileSync(bookingQuoteAndConfirmationRestoreMigrationPath, "utf8");

    expect(sql).toContain("new.price_cents is distinct from old.price_cents");
    expect(sql).toContain("new.currency is distinct from old.currency");
    expect(sql).toContain("'priceCents', hold.price_cents");
    expect(sql).toContain("create function public.public_booking_confirm_session_v4");
    expect(sql).toContain("create function public.public_booking_restore_session_confirmation");
    expect(sql).toContain("appointment_row.public_booking_idempotency_key_hash = p_idempotency_key_hash");
    expect(sql).toContain("grant execute on function public.public_booking_restore_session_confirmation");
  });

  it("indexes confirmed session recovery without scanning historical holds", () => {
    const sql = readFileSync(confirmationRestoreIndexMigrationPath, "utf8");

    expect(sql).toContain("(session_key_hash, confirmed_at desc)");
    expect(sql).toContain("where status = 'confirmed' and session_key_hash is not null");
  });

  it("enforces half-hour public starts and a short same-day lead", () => {
    const sql = readFileSync(halfHourGridMigrationPath, "utf8");
    const slotFunction = sql.slice(
      sql.indexOf("create or replace function public.public_booking_slot_in_schedule"),
      sql.indexOf("create or replace function public.admin_save_booking_settings_with_audit"),
    );
    const settingsFunction = sql.slice(
      sql.indexOf("create or replace function public.admin_save_booking_settings_with_audit"),
    );

    expect(sql).toContain("alter column booking_slot_step_minutes set default 30");
    expect(sql).toContain("alter column booking_min_lead_minutes set default 30");
    expect(sql).toContain("booking_slot_step_minutes = 30");
    expect(sql).toContain("booking_min_lead_minutes = 30");
    expect(sql).toContain("check (booking_slot_step_minutes = 30)");
    expect(sql).toContain("check (booking_min_lead_minutes = 30)");
    expect(slotFunction).toContain("p_slot_step_minutes = 30");
    expect(slotFunction).toContain("start_minutes % p_slot_step_minutes = 0");
    expect(settingsFunction).toContain("(p_settings ->> 'booking_slot_step_minutes')::integer <> 30");
    expect(settingsFunction).toContain("(p_settings ->> 'booking_min_lead_minutes')::integer <> 30");
    expect(settingsFunction).toContain("grant execute on function public.admin_save_booking_settings_with_audit");
  });

  it("expires pre-migration quarter-hour holds instead of restoring an unconfirmable selection", () => {
    const sql = readFileSync(expireQuarterHourHoldsMigrationPath, "utf8");

    expect(sql).toContain("update public.public_booking_holds");
    expect(sql).toContain("set status = 'expired'");
    expect(sql).toContain("where status = 'active'");
    expect(sql).toContain("extract(minute from starts_at)::integer % 30 <> 0");
  });

  it("keeps public booking buffers while allowing back-to-back admin appointments", () => {
    const sql = readFileSync(backToBackAdminAppointmentsMigrationPath, "utf8");
    const publicBookingSql = readFileSync(publicBookingHardeningMigrationPath, "utf8");

    expect(sql).toContain("drop constraint if exists admin_appointments_active_schedule_excl");
    expect(sql).toContain("make_interval(mins => duration_minutes)");
    expect(sql).not.toContain("duration_minutes + buffer_minutes");
    expect(sql).toContain("and not overlap_override");
    expect(publicBookingSql).toContain("variant.duration_minutes + settings.booking_buffer_minutes");
    expect(publicBookingSql).toContain("appointment.duration_minutes + appointment.buffer_minutes");
  });

  it("removes the obsolete confirmation overload before adding contact preference", () => {
    const sql = readFileSync(holdPriceAndContactMigrationPath, "utf8");

    expect(sql).toContain("drop function if exists public.public_booking_confirm");
    expect(sql).toContain("text, text, text, text, text, text, text, text, boolean");
  });

  it("isolates specialist calendars and contact access in the latest migration", () => {
    const sql = readFileSync(multiSpecialistSecurityMigrationPath, "utf8");

    expect(sql).toContain("create table if not exists public.admin_specialists");
    expect(sql).toContain("specialist_id with =");
    expect(sql).toContain("public_daily_limit integer not null default 8");
    expect(sql).toContain("create or replace function public.public_booking_specialist_available");
    expect(sql).toContain("create or replace function public.admin_mutate_specialist_calendar_block");
    expect(sql).toContain("create or replace function public.admin_reveal_appointment_contact");
    expect(sql).toContain("revoke select on table public.admin_clients from authenticated");
    expect(sql).toContain("client.contact.reveal");
    expect(sql).toContain("bulk_contact_reveal");
  });

  it("tracks aal2 logins and protects the last active owner", () => {
    const mfaSql = readFileSync(adminMfaTrackingMigrationPath, "utf8");
    const ownerSql = readFileSync(lastOwnerProtectionMigrationPath, "utf8");

    expect(mfaSql).toContain("mfa_verified_at");
    expect(mfaSql).toContain("'assurance_level', 'aal2'");
    expect(ownerSql).toContain("last_active_owner_required");
    expect(ownerSql).toContain("before update of role, status or delete");
  });

  it("removes direct staff reads and finalizes specialist offboarding", () => {
    const sql = readFileSync(specialistOffboardingMigrationPath, "utf8");

    expect(sql).toContain("revoke select on table public.admin_profiles from authenticated");
    expect(sql).toContain("revoke select on table public.admin_audit_log from authenticated");
    expect(sql).toContain("create or replace function public.admin_finalize_specialist_offboarding");
    expect(sql).toContain("status = 'offboarded'");
    expect(sql).toContain("set status = 'expired'");
    expect(sql).toContain("after update of role, status or delete");
  });

  it("hardens specialist authorization, concurrency, assignment, and alert RPCs", () => {
    const sql = readFileSync(multiSpecialistHardeningMigrationPath, "utf8");
    const appointmentRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_save_appointment_with_audit"),
      sql.indexOf("create or replace function public.admin_lock_public_daily_limit"),
    );
    const holdRpc = sql.slice(
      sql.indexOf("create or replace function public.public_booking_create_hold"),
      sql.indexOf("create or replace function public.admin_reveal_appointment_contact"),
    );
    const revealRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_reveal_appointment_contact"),
      sql.indexOf("create or replace function public.admin_protect_last_active_owner"),
    );
    const alertListRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_list_security_alerts()"),
      sql.indexOf("create or replace function public.admin_resolve_security_alert"),
    );
    const alertResolveRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_resolve_security_alert"),
      sql.indexOf("-- Preserve the server write boundary"),
    );

    expect(appointmentRpc).toContain("appointment_client_forbidden");
    expect(appointmentRpc).toContain("assigned_appointment.specialist_id = actor_specialist_id");
    expect(appointmentRpc).toContain("assigned_appointment.client_id = requested_client_id");
    expect(appointmentRpc).toContain("appointment_public_hold_conflict");
    expect(appointmentRpc).not.toContain("public_booking_daily_limit");

    expect(sql).toContain("hashtextextended('admin-contact-reveal:' || p_actor_user_id::text, 0)");
    expect(revealRpc).toContain("recent_reveals >= 60");
    expect(revealRpc).toContain("recent_reveals >= 19");
    expect(revealRpc).toContain("appointment.status not in ('confirmed', 'pending', 'request')");
    expect(revealRpc).toContain("interval '48 hours'");
    expect(revealRpc).toContain("interval '180 days'");
    expect(sql).toContain("hashtextextended('admin-active-owner', 0)");

    expect(sql).toContain("create trigger sync_public_daily_limit");
    expect(sql).toContain("new.public_daily_limit := canonical_daily_limit");
    expect(sql).toContain("hashtextextended('admin-public-daily-limit', 0)");
    expect(sql).toContain("specialist.public_daily_limit is distinct from new.public_booking_daily_limit");
    expect(sql).toContain("create trigger assign_new_service_to_specialists");
    expect(sql).toContain("create trigger assign_specialist_to_services_on_insert");
    expect(sql).toContain("hashtextextended('admin-specialist-services', 0)");
    expect(sql).toContain("specialist.status = 'active'");
    expect(sql).toContain("specialist.public_booking_enabled");

    expect(holdRpc).toContain("from public.public_booking_holds active_hold");
    expect(holdRpc).toContain("active_hold.expires_at > now()");
    expect(holdRpc).toContain("active_hold.id <> existing_session_hold.id");

    expect(alertListRpc).toContain("returns table (");
    expect(alertListRpc).toContain("actor_name text");
    expect(alertListRpc).toContain("event_count integer");
    expect(alertListRpc).toContain("security definer");
    expect(alertListRpc).toContain("coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'");
    expect(alertListRpc).toContain("profile.role::text in ('owner', 'administrator')");
    expect(alertListRpc).toContain("coalesce(auth.role(), '') = 'service_role'");
    expect(alertListRpc).not.toContain("alert.actor_user_id,");
    expect(alertListRpc).not.toContain("alert.metadata,");
    expect(alertResolveRpc).toContain("returns boolean");
    expect(alertResolveRpc).toContain("alert.resolved_at is null");
    expect(alertResolveRpc).toContain("return false;");
    expect(alertResolveRpc).toContain("return true;");
    expect(alertResolveRpc).toContain("'security_alert.resolve'");
    expect(sql).toContain("grant execute on function public.admin_list_security_alerts() to authenticated, service_role");
    expect(alertResolveRpc).toContain("p_actor_user_id uuid default null");
    expect(alertResolveRpc).toContain("actor_user_id uuid := coalesce(authenticated_user_id, p_actor_user_id)");
    expect(sql).toContain("grant execute on function public.admin_resolve_security_alert(uuid, uuid) to authenticated, service_role");
    expect(sql).toContain("revoke all on table public.admin_security_alerts from anon, authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.admin_security_alerts to service_role");
  });

  it("adds explicit public specialist choice and removes specialist contact access", () => {
    const sql = readFileSync(specialistChoiceMigrationPath, "utf8");
    const revealRpc = sql.slice(
      sql.indexOf("create or replace function public.admin_reveal_appointment_contact"),
      sql.indexOf("revoke all on function public.public_booking_get_availability_v2"),
    );

    expect(sql).toContain("'specialists'");
    expect(sql).toContain("create function public.public_booking_get_availability_v2");
    expect(sql).toContain("create function public.public_booking_create_hold_v5");
    expect(sql).toContain("p_specialist_id uuid default null");
    expect(sql).toContain("new.specialist_id is distinct from old.specialist_id");
    expect(sql).toContain("(p_specialist_id is null or specialist.id = p_specialist_id)");
    expect(revealRpc).toContain("profile.role::text in ('owner', 'administrator')");
    expect(revealRpc).not.toContain("profile.role::text in ('owner', 'administrator', 'specialist')");
  });

  it("keeps appointment mutations owner and administrator only", () => {
    const sql = readFileSync(specialistAppointmentLockMigrationPath, "utf8");

    expect(sql).toContain("rename to admin_save_appointment_with_audit_internal");
    expect(sql).toContain("profile.role::text in ('owner', 'administrator')");
    expect(sql).toContain("message = 'appointment_forbidden'");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function public.admin_save_appointment_with_audit_internal");
    expect(sql).toContain("to service_role");
  });

  it("restores serialized owner-only contact reveal limits", () => {
    const sql = readFileSync(contactRevealLimitsMigrationPath, "utf8");

    expect(sql).toContain("profile.role::text in ('owner', 'administrator')");
    expect(sql).not.toContain("profile.role::text in ('owner', 'administrator', 'specialist')");
    expect(sql).toContain("hashtextextended('admin-contact-reveal:' || p_actor_user_id::text, 0)");
    expect(sql).toContain("recent_reveals >= 60");
    expect(sql).toContain("recent_reveals >= 19");
    expect(sql).toContain("'bulk_contact_reveal'");
    expect(sql).toContain("'client.contact.reveal'");
  });

  it("keeps internal specialist UUIDs behind public slug RPCs", () => {
    const sql = readFileSync(publicSpecialistSlugsMigrationPath, "utf8");

    expect(sql).toContain("create function public.public_booking_get_options_v2");
    expect(sql).toContain("jsonb_build_object('id', specialist_row.public_slug)");
    expect(sql).toContain("create function public.public_booking_get_availability_v3");
    expect(sql).toContain("create function public.public_booking_create_hold_v6");
    expect(sql).toContain("create function public.public_booking_restore_session_hold_v6");
    expect(sql).toContain("where specialist.public_slug = btrim(p_specialist_slug)");
    expect(sql).toContain("result - 'specialistId'");
    expect(sql).toContain("'specialistId', specialist_slug");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
  });
});
