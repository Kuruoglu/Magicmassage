import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const appointmentIds = new Set();
const blockIds = new Set();
const clientIds = new Set();
const idempotencyHashes = new Set();
const tokenHashes = new Set();
const sessionHashes = new Set();
const specialistIds = new Set();
const serviceSlugs = new Set();
const runId = randomUUID().replaceAll("-", "");
let adminUserId;
let specialistUserId;

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function opaqueHash(target) {
  const value = hash(randomBytes(32).toString("base64url"));
  target.add(value);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function errorMatches(error, message) {
  return error?.message?.includes(message) === true;
}

function sofiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Sofia",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}`;
}

function addMinutes(time, minutes) {
  const [hours, currentMinutes] = time.split(":").map(Number);
  const total = hours * 60 + currentMinutes + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function appointmentRecord({
  bufferMinutes = 0,
  clientId,
  date,
  durationMinutes = 30,
  id,
  note = "Booking DB smoke",
  status = "confirmed",
  time,
  version = null,
  specialistId,
}) {
  return {
    buffer_minutes: bufferMinutes,
    client_id: clientId,
    client_name_snapshot: "Booking DB Smoke",
    duration_minutes: durationMinutes,
    id,
    internal_note: note,
    overlap_override: false,
    overlap_override_reason: "",
    overlap_overridden_at: null,
    overlap_overridden_by: null,
    post_visit_comment: "",
    post_visit_commented_at: null,
    service_name: "Booking DB smoke service",
    ...(specialistId ? { specialist_id: specialistId } : {}),
    starts_at: time,
    starts_on: date,
    status,
    version,
  };
}

async function createHold({ date, priceVariantId, sessionKeyHash, specialistSlug = null, time, tokenHash }) {
  return supabase.rpc("public_booking_create_hold_v6", {
    p_price_variant_id: priceVariantId,
    p_session_key_hash: sessionKeyHash,
    p_specialist_slug: specialistSlug,
    p_starts_at: time,
    p_starts_on: date,
    p_token_hash: tokenHash,
  });
}

async function saveAppointment(record, action = "appointment.create", actorUserId = adminUserId) {
  return supabase.rpc("admin_save_appointment_with_audit", {
    p_action: action,
    p_actor_user_id: actorUserId,
    p_audit_metadata: { source: "booking_db_smoke" },
    p_record: record,
  });
}

async function mutateBlock({
  action = "upsert",
  blockDate,
  blockId = null,
  endsAt,
  expectedVersion = null,
  note = "Booking DB smoke",
  startsAt,
  specialistId = null,
}) {
  return supabase.rpc("admin_mutate_specialist_calendar_block", {
    p_action: action,
    p_actor_user_id: adminUserId,
    p_block_date: blockDate,
    p_block_id: blockId,
    p_ends_at: endsAt,
    p_expected_version: expectedVersion,
    p_internal_note: note,
    p_kind: "personal",
    p_specialist_id: specialistId,
    p_starts_at: startsAt,
  });
}

async function confirmBooking({
  careEmailOptIn = false,
  idempotencyKeyHash,
  phone,
  selectionId,
  selectionVersion,
  sessionKeyHash,
}) {
  return supabase.rpc("public_booking_confirm_session_v5", {
    p_care_email_opt_in: careEmailOptIn,
    p_contact_preference: "email",
    p_email: "submitted-booking@example.com",
    p_full_name: "Submitted Booking Name",
    p_idempotency_key_hash: idempotencyKeyHash,
    p_locale: "en",
    p_phone: `+${phone}`,
    p_phone_normalized: phone,
    p_privacy_accepted: true,
    p_public_note: "Public snapshot smoke",
    p_selection_id: selectionId,
    p_selection_version: selectionVersion,
    p_session_key_hash: sessionKeyHash,
  });
}

async function expireSessions(sessions) {
  const result = await supabase
    .from("public_booking_holds")
    .update({ status: "expired" })
    .in("session_key_hash", sessions);
  if (result.error) throw result.error;
}

async function cleanup() {
  const cleanupErrors = [];

  if (idempotencyHashes.size > 0) {
    const lookup = await supabase
      .from("admin_appointments")
      .select("id, client_id")
      .in("public_booking_idempotency_key_hash", [...idempotencyHashes]);
    if (lookup.error) cleanupErrors.push(lookup.error);
    for (const row of lookup.data ?? []) {
      appointmentIds.add(row.id);
      clientIds.add(row.client_id);
    }
  }

  const entityIds = [...appointmentIds, ...blockIds];
  if (entityIds.length > 0) {
    const auditResult = await supabase.from("admin_audit_log").delete().in("entity_id", entityIds);
    if (auditResult.error) cleanupErrors.push(auditResult.error);
  }
  if (appointmentIds.size > 0) {
    const result = await supabase.from("admin_appointments").delete().in("id", [...appointmentIds]);
    if (result.error) cleanupErrors.push(result.error);
  }
  if (blockIds.size > 0) {
    const result = await supabase.from("admin_calendar_blocks").delete().in("id", [...blockIds]);
    if (result.error) cleanupErrors.push(result.error);
  }
  if (sessionHashes.size > 0) {
    const result = await supabase
      .from("public_booking_holds")
      .delete()
      .in("session_key_hash", [...sessionHashes]);
    if (result.error) cleanupErrors.push(result.error);
  }
  if (tokenHashes.size > 0) {
    const result = await supabase
      .from("public_booking_holds")
      .delete()
      .in("token_hash", [...tokenHashes]);
    if (result.error) cleanupErrors.push(result.error);
  }
  if (clientIds.size > 0) {
    const result = await supabase.from("admin_clients").delete().in("id", [...clientIds]);
    if (result.error) cleanupErrors.push(result.error);
  }
  if (adminUserId) {
    const alertResult = await supabase
      .from("admin_security_alerts")
      .delete()
      .eq("actor_user_id", adminUserId);
    if (alertResult.error) cleanupErrors.push(alertResult.error);

    const auditResult = await supabase
      .from("admin_audit_log")
      .delete()
      .eq("actor_user_id", adminUserId);
    if (auditResult.error) cleanupErrors.push(auditResult.error);

    const profileResult = await supabase.from("admin_profiles").delete().eq("user_id", adminUserId);
    if (profileResult.error) cleanupErrors.push(profileResult.error);

    const userResult = await supabase.auth.admin.deleteUser(adminUserId);
    if (userResult.error) cleanupErrors.push(userResult.error);
  }
  if (specialistUserId) {
    const profileResult = await supabase.from("admin_profiles").delete().eq("user_id", specialistUserId);
    if (profileResult.error) cleanupErrors.push(profileResult.error);

    const userResult = await supabase.auth.admin.deleteUser(specialistUserId);
    if (userResult.error) cleanupErrors.push(userResult.error);
  }
  if (specialistIds.size > 0) {
    const result = await supabase.from("admin_specialists").delete().in("id", [...specialistIds]);
    if (result.error) cleanupErrors.push(result.error);

    const [envelopeResult, settingsResult] = await Promise.all([
      supabase.rpc("admin_get_specialist_schedule_envelope"),
      supabase
        .from("admin_site_settings")
        .select("working_days, working_hours")
        .eq("id", "site")
        .single(),
    ]);
    if (envelopeResult.error) cleanupErrors.push(envelopeResult.error);
    if (settingsResult.error) cleanupErrors.push(settingsResult.error);
    if (!envelopeResult.error && !settingsResult.error) {
      const specialistDeleteEnvelopeSynchronized =
        settingsResult.data.working_days === envelopeResult.data.working_days
        && settingsResult.data.working_hours === envelopeResult.data.working_hours;
      if (output) output.specialistDeleteEnvelopeSynchronized = specialistDeleteEnvelopeSynchronized;
      if (!specialistDeleteEnvelopeSynchronized) {
        cleanupErrors.push(new Error("Specialist deletion did not recompute the booking envelope."));
      }
    }
  }
  if (serviceSlugs.size > 0) {
    const result = await supabase.from("admin_services").delete().in("slug", [...serviceSlugs]);
    if (result.error) cleanupErrors.push(result.error);
  }

  if (cleanupErrors.length > 0) {
    throw new Error(`Booking DB smoke cleanup failed: ${cleanupErrors.map((error) => error.message).join("; ")}`);
  }
}

let output;

try {
  const { data: options, error: optionsError } = await supabase.rpc("public_booking_get_options_v2", {
    p_locale: "en",
  });
  if (optionsError) throw optionsError;
  const priceVariantId = options?.services?.[0]?.variants?.[0]?.id;
  assert(typeof priceVariantId === "string", "No public booking price variant is available.");
  const variantResult = await supabase
    .from("admin_price_variants")
    .select("duration_minutes, service_slug")
    .eq("id", priceVariantId)
    .single();
  if (variantResult.error) throw variantResult.error;
  const serviceSlug = variantResult.data.service_slug;

  const settingsResult = await supabase
    .from("admin_site_settings")
    .select("booking_buffer_minutes, booking_min_lead_minutes, booking_slot_step_minutes, public_booking_daily_limit, public_booking_enabled")
    .eq("id", "site")
    .single();
  if (settingsResult.error) throw settingsResult.error;
  assert(settingsResult.data.public_booking_enabled, "Public booking must be enabled for the DB smoke.");
  const publicDailyLimit = settingsResult.data.public_booking_daily_limit;
  assert(
    Number.isInteger(publicDailyLimit) && publicDailyLimit >= 1 && publicDailyLimit <= 8,
    "Public booking daily limit must be between 1 and 8.",
  );
  assert(settingsResult.data.booking_slot_step_minutes === 30, "Public booking slot step must be 30 minutes.");
  assert(settingsResult.data.booking_min_lead_minutes === 30, "Public booking same-day lead must be 30 minutes.");

  const { data: availability, error: availabilityError } = await supabase.rpc(
    "public_booking_get_availability_v3",
    { p_days: 31, p_from: sofiaToday(), p_price_variant_id: priceVariantId, p_specialist_slug: null },
  );
  if (availabilityError) throw availabilityError;
  const candidates = availability?.days?.filter(
    (day) => Array.isArray(day.slots) && day.slots.length >= 2,
  ) ?? [];
  assert(candidates.length >= 2, "Two dates with at least two free slots are required for the DB smoke.");
  const halfHourGridEnforced = availability.days.every((day) =>
    day.slots.every((slot) => Number(slot.slice(3, 5)) % 30 === 0),
  );
  const [capacityDay, versionDay] = candidates;

  const offGridHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: opaqueHash(sessionHashes),
    time: addMinutes(capacityDay.slots[0], 15),
    tokenHash: opaqueHash(tokenHashes),
  });
  const offGridStartRejected = errorMatches(offGridHold.error, "slot_unavailable");

  const userResult = await supabase.auth.admin.createUser({
    email: `booking-db-${runId}@example.com`,
    email_confirm: true,
    password: randomBytes(24).toString("base64url"),
  });
  if (userResult.error) throw userResult.error;
  adminUserId = userResult.data.user.id;

  const profileResult = await supabase.from("admin_profiles").insert({
    display_name: "Booking DB Smoke",
    email: `booking-db-${runId}@example.com`,
    role: "owner",
    status: "active",
    user_id: adminUserId,
  });
  if (profileResult.error) throw profileResult.error;

  const phone = `35988${String(Date.now()).slice(-7)}`;
  const clientId = `client-booking-db-${runId}`;
  clientIds.add(clientId);
  const clientResult = await supabase.from("admin_clients").insert({
    email: "existing-client@example.com",
    full_name: "Existing CRM Name",
    id: clientId,
    locale: "bg",
    notes: "Existing CRM note",
    phone: `+${phone}`,
    phone_normalized: phone,
    preferred_contact: "telegram",
    status: "returning",
  });
  if (clientResult.error) throw clientResult.error;

  const defaultSpecialist = await supabase
    .from("admin_specialists")
    .select("id, public_slug")
    .eq("is_default", true)
    .single();
  if (defaultSpecialist.error) throw defaultSpecialist.error;
  const secondSpecialistId = randomUUID();
  const secondSpecialistSlug = `booking-db-${runId.slice(0, 12)}`;
  specialistIds.add(secondSpecialistId);
  const secondSpecialist = await supabase.from("admin_specialists").insert({
    color: "#4f6ea8",
    display_name: "Booking DB Second Specialist",
    display_order: 999,
    id: secondSpecialistId,
    is_default: false,
    public_booking_enabled: false,
    public_daily_limit: publicDailyLimit === 8 ? 1 : 8,
    public_slug: secondSpecialistSlug,
    status: "active",
  });
  if (secondSpecialist.error) throw secondSpecialist.error;
  const synchronizedSecondSpecialist = await supabase
    .from("admin_specialists")
    .select("public_daily_limit")
    .eq("id", secondSpecialistId)
    .single();
  if (synchronizedSecondSpecialist.error) throw synchronizedSecondSpecialist.error;
  const dailyLimitSynchronized = synchronizedSecondSpecialist.data.public_daily_limit === publicDailyLimit;
  const assignment = await supabase.from("admin_specialist_services").insert({
    service_slug: serviceSlug,
    specialist_id: secondSpecialistId,
  });
  if (assignment.error) throw assignment.error;

  const secondScheduleSnapshot = await supabase
    .from("admin_specialists")
    .select("schedule_version, weekly_schedule")
    .eq("id", secondSpecialistId)
    .single();
  if (secondScheduleSnapshot.error) throw secondScheduleSnapshot.error;
  const capacityWeekday = new Date(`${capacityDay.date}T12:00:00Z`).getUTCDay() || 7;
  const originalCapacityDaySchedule = secondScheduleSnapshot.data.weekly_schedule.find(
    (day) => day.weekday === capacityWeekday,
  );
  assert(originalCapacityDaySchedule?.isWorking, "The schedule smoke needs a working capacity day.");
  const delayedStart = addMinutes(capacityDay.slots[0], 30);
  assert(
    delayedStart < originalCapacityDaySchedule.endsAt,
    "The schedule smoke needs room to delay the first slot by 30 minutes.",
  );
  const delayedSchedule = secondScheduleSnapshot.data.weekly_schedule.map((day) =>
    day.weekday === capacityWeekday ? { ...day, isWorking: true, startsAt: delayedStart } : day
  );
  const delayedScheduleSave = await supabase.rpc("admin_save_specialist_schedule_v2", {
    p_actor_user_id: adminUserId,
    p_expected_version: secondScheduleSnapshot.data.schedule_version,
    p_specialist_id: secondSpecialistId,
    p_weekly_schedule: delayedSchedule,
  });
  if (delayedScheduleSave.error) throw delayedScheduleSave.error;
  const scheduleVersionAdvanced = delayedScheduleSave.data.specialist.schedule_version
    === secondScheduleSnapshot.data.schedule_version + 1;

  const enableScheduleSmokeSpecialist = await supabase
    .from("admin_specialists")
    .update({ public_booking_enabled: true })
    .eq("id", secondSpecialistId);
  if (enableScheduleSmokeSpecialist.error) throw enableScheduleSmokeSpecialist.error;

  const rejectedScheduleSession = opaqueHash(sessionHashes);
  const rejectedScheduleHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: rejectedScheduleSession,
    specialistSlug: secondSpecialistSlug,
    time: capacityDay.slots[0],
    tokenHash: opaqueHash(tokenHashes),
  });
  const specialistScheduleRejectsClosedSlot = errorMatches(
    rejectedScheduleHold.error,
    "slot_unavailable",
  );

  const restoredScheduleSave = await supabase.rpc("admin_save_specialist_schedule_v2", {
    p_actor_user_id: adminUserId,
    p_expected_version: delayedScheduleSave.data.specialist.schedule_version,
    p_specialist_id: secondSpecialistId,
    p_weekly_schedule: secondScheduleSnapshot.data.weekly_schedule,
  });
  if (restoredScheduleSave.error) throw restoredScheduleSave.error;

  const restoredScheduleSession = opaqueHash(sessionHashes);
  const restoredScheduleHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: restoredScheduleSession,
    specialistSlug: secondSpecialistSlug,
    time: capacityDay.slots[0],
    tokenHash: opaqueHash(tokenHashes),
  });
  if (restoredScheduleHold.error) throw restoredScheduleHold.error;
  const specialistScheduleAllowsRestoredSlot = restoredScheduleHold.data.specialistId
    === secondSpecialistSlug;
  await expireSessions([rejectedScheduleSession, restoredScheduleSession]);

  const staleScheduleSave = await supabase.rpc("admin_save_specialist_schedule_v2", {
    p_actor_user_id: adminUserId,
    p_expected_version: delayedScheduleSave.data.specialist.schedule_version,
    p_specialist_id: secondSpecialistId,
    p_weekly_schedule: delayedSchedule,
  });
  const staleSpecialistScheduleRejected = staleScheduleSave.error?.code === "40001"
    || errorMatches(staleScheduleSave.error, "stale_specialist_schedule");

  const envelopeBeforeStaleSettings = await supabase
    .from("admin_site_settings")
    .select("working_days, working_hours")
    .eq("id", "site")
    .single();
  if (envelopeBeforeStaleSettings.error) throw envelopeBeforeStaleSettings.error;
  const staleSettingsWrite = await supabase
    .from("admin_site_settings")
    .update({ working_days: "Sun", working_hours: "23:00-23:30" })
    .eq("id", "site");
  if (staleSettingsWrite.error) throw staleSettingsWrite.error;
  const envelopeAfterStaleSettings = await supabase
    .from("admin_site_settings")
    .select("working_days, working_hours")
    .eq("id", "site")
    .single();
  if (envelopeAfterStaleSettings.error) throw envelopeAfterStaleSettings.error;
  const settingsCannotOverwriteScheduleEnvelope =
    envelopeAfterStaleSettings.data.working_days === envelopeBeforeStaleSettings.data.working_days
    && envelopeAfterStaleSettings.data.working_hours === envelopeBeforeStaleSettings.data.working_hours;

  const disableScheduleSmokeSpecialist = await supabase
    .from("admin_specialists")
    .update({ public_booking_enabled: false })
    .eq("id", secondSpecialistId);
  if (disableScheduleSmokeSpecialist.error) throw disableScheduleSmokeSpecialist.error;

  const eligibleSpecialists = await supabase
    .from("admin_specialists")
    .select("id")
    .eq("status", "active")
    .eq("public_booking_enabled", true);
  if (eligibleSpecialists.error) throw eligibleSpecialists.error;
  const testServiceSlug = `booking-db-service-${runId}`;
  serviceSlugs.add(testServiceSlug);
  const testService = await supabase.from("admin_services").insert({
    category: "DB smoke",
    name: "Booking DB smoke service assignment",
    slug: testServiceSlug,
    status: "draft",
  });
  if (testService.error) throw testService.error;
  const testServiceAssignments = await supabase
    .from("admin_specialist_services")
    .select("specialist_id")
    .eq("service_slug", testServiceSlug);
  if (testServiceAssignments.error) throw testServiceAssignments.error;
  const assignedSpecialistIds = new Set(testServiceAssignments.data.map((row) => row.specialist_id));
  const newServiceAutoAssigned = eligibleSpecialists.data.length > 0
    && eligibleSpecialists.data.every((specialist) => assignedSpecialistIds.has(specialist.id));

  const specialistUserResult = await supabase.auth.admin.createUser({
    email: `booking-db-specialist-${runId}@example.com`,
    email_confirm: true,
    password: randomBytes(24).toString("base64url"),
  });
  if (specialistUserResult.error) throw specialistUserResult.error;
  specialistUserId = specialistUserResult.data.user.id;
  specialistIds.add(specialistUserId);
  const specialistProfile = await supabase.from("admin_profiles").insert({
    display_name: "Booking DB Specialist",
    email: `booking-db-specialist-${runId}@example.com`,
    role: "specialist",
    status: "active",
    user_id: specialistUserId,
  });
  if (specialistProfile.error) throw specialistProfile.error;
  const disablePublicSpecialist = await supabase
    .from("admin_specialists")
    .update({ public_booking_enabled: false })
    .eq("id", specialistUserId);
  if (disablePublicSpecialist.error) throw disablePublicSpecialist.error;

  const forbiddenSpecialistAppointmentId = `appointment-booking-db-specialist-forbidden-${runId}`;
  appointmentIds.add(forbiddenSpecialistAppointmentId);
  const forbiddenSpecialistAppointment = await saveAppointment(appointmentRecord({
    clientId,
    date: versionDay.date,
    id: forbiddenSpecialistAppointmentId,
    specialistId: specialistUserId,
    time: "04:00",
  }), "appointment.create", specialistUserId);
  const specialistArbitraryClientRejected = errorMatches(
    forbiddenSpecialistAppointment.error,
    "appointment_forbidden",
  );

  const specialistSeedAppointmentId = `appointment-booking-db-specialist-seed-${runId}`;
  appointmentIds.add(specialistSeedAppointmentId);
  const specialistSeedAppointment = await saveAppointment(appointmentRecord({
    clientId,
    date: versionDay.date,
    id: specialistSeedAppointmentId,
    specialistId: specialistUserId,
    time: "04:00",
  }));
  if (specialistSeedAppointment.error) throw specialistSeedAppointment.error;
  const allowedSpecialistAppointmentId = `appointment-booking-db-specialist-allowed-${runId}`;
  appointmentIds.add(allowedSpecialistAppointmentId);
  const allowedSpecialistAppointment = await saveAppointment(appointmentRecord({
    clientId,
    date: versionDay.date,
    id: allowedSpecialistAppointmentId,
    specialistId: specialistUserId,
    time: "04:30",
  }), "appointment.create", specialistUserId);
  const specialistAssignedClientRejected = errorMatches(
    allowedSpecialistAppointment.error,
    "appointment_forbidden",
  );

  const oldHoldResult = await supabase.rpc("public_booking_create_hold", {
    p_price_variant_id: priceVariantId,
    p_starts_at: capacityDay.slots[0],
    p_starts_on: capacityDay.date,
    p_token_hash: opaqueHash(tokenHashes),
  });
  const obsoleteHoldRpcRemoved = oldHoldResult.error?.code === "PGRST202";

  const oldConfirmResult = await supabase.rpc("public_booking_confirm", {
    p_email: null,
    p_full_name: "Booking DB Smoke",
    p_idempotency_key_hash: opaqueHash(idempotencyHashes),
    p_locale: "en",
    p_phone: "+359881112233",
    p_phone_normalized: "359881112233",
    p_privacy_accepted: true,
    p_public_note: "",
    p_token_hash: opaqueHash(tokenHashes),
  });
  const obsoleteConfirmRpcRemoved = oldConfirmResult.error?.code === "PGRST202";

  const replacementSession = opaqueHash(sessionHashes);
  const firstReplacementToken = opaqueHash(tokenHashes);
  const secondReplacementToken = opaqueHash(tokenHashes);
  const firstHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: replacementSession,
    time: capacityDay.slots[0],
    tokenHash: firstReplacementToken,
  });
  if (firstHold.error) throw firstHold.error;
  const replacementHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: replacementSession,
    time: capacityDay.slots[1],
    tokenHash: secondReplacementToken,
  });
  if (replacementHold.error) throw replacementHold.error;

  const staleSelection = await confirmBooking({
    idempotencyKeyHash: opaqueHash(idempotencyHashes),
    phone,
    selectionId: firstHold.data.selectionId,
    selectionVersion: firstHold.data.selectionVersion,
    sessionKeyHash: replacementSession,
  });
  const staleSelectionVersionRejected = replacementHold.data.selectionVersion
    === firstHold.data.selectionVersion + 1
    && errorMatches(staleSelection.error, "slot_unavailable");

  const replacementRows = await supabase
    .from("public_booking_holds")
    .select("id, token_hash, starts_at, status")
    .eq("session_key_hash", replacementSession);
  if (replacementRows.error) throw replacementRows.error;
  const sessionHoldReplaced = replacementRows.data.length === 1
    && replacementRows.data[0].token_hash === secondReplacementToken
    && replacementRows.data[0].status === "active";

  const restoredReplacementToken = opaqueHash(tokenHashes);
  const restoredReplacement = await supabase.rpc("public_booking_restore_session_hold_v4", {
    p_session_key_hash: replacementSession,
    p_token_hash: restoredReplacementToken,
  });
  if (restoredReplacement.error) throw restoredReplacement.error;
  const restoredReplacementRow = await supabase
    .from("public_booking_holds")
    .select("token_hash")
    .eq("session_key_hash", replacementSession)
    .single();
  if (restoredReplacementRow.error) throw restoredReplacementRow.error;
  const sessionHoldRestored = restoredReplacement.data.date === capacityDay.date
    && restoredReplacement.data.time === capacityDay.slots[1]
    && restoredReplacement.data.selectionId === replacementHold.data.selectionId
    && restoredReplacement.data.selectionVersion === replacementHold.data.selectionVersion
    && restoredReplacementRow.data.token_hash === restoredReplacementToken;

  const expired = await supabase
    .from("public_booking_holds")
    .update({ status: "expired" })
    .eq("session_key_hash", replacementSession)
    .select("session_key_hash")
    .single();
  if (expired.error) throw expired.error;
  const inactiveSessionReleased = expired.data.session_key_hash === null;

  const recreatedHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: replacementSession,
    time: capacityDay.slots[0],
    tokenHash: opaqueHash(tokenHashes),
  });
  if (recreatedHold.error) throw recreatedHold.error;
  const staleRecreatedSelection = await confirmBooking({
    idempotencyKeyHash: opaqueHash(idempotencyHashes),
    phone,
    selectionId: firstHold.data.selectionId,
    selectionVersion: firstHold.data.selectionVersion,
    sessionKeyHash: replacementSession,
  });
  const staleSelectionIdentityRejected = recreatedHold.data.selectionVersion
    === firstHold.data.selectionVersion
    && recreatedHold.data.selectionId !== firstHold.data.selectionId
    && errorMatches(staleRecreatedSelection.error, "slot_unavailable");
  await expireSessions([replacementSession]);

  const contenderSessions = [opaqueHash(sessionHashes), opaqueHash(sessionHashes)];
  const contenderTokens = [opaqueHash(tokenHashes), opaqueHash(tokenHashes)];
  const contenders = await Promise.all(contenderSessions.map((sessionKeyHash, index) => createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash,
    time: capacityDay.slots[0],
    tokenHash: contenderTokens[index],
  })));
  const successes = contenders.filter((result) => !result.error);
  const conflicts = contenders.filter((result) => errorMatches(result.error, "slot_unavailable"));
  const concurrentSlotSerialized = successes.length === 1 && conflicts.length === 1;
  await expireSessions(contenderSessions);

  const conflictSession = opaqueHash(sessionHashes);
  const conflictToken = opaqueHash(tokenHashes);
  const conflictHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: conflictSession,
    time: capacityDay.slots[0],
    tokenHash: conflictToken,
  });
  if (conflictHold.error) throw conflictHold.error;
  const heldSpecialist = await supabase
    .from("public_booking_holds")
    .select("specialist_id")
    .eq("token_hash", conflictToken)
    .single();
  if (heldSpecialist.error) throw heldSpecialist.error;
  const conflictAppointmentId = `appointment-booking-db-conflict-${runId}`;
  appointmentIds.add(conflictAppointmentId);
  const conflictAppointment = await saveAppointment(appointmentRecord({
    clientId,
    date: capacityDay.date,
    id: conflictAppointmentId,
    specialistId: heldSpecialist.data.specialist_id,
    status: "confirmed",
    time: capacityDay.slots[0],
  }));
  const holdBlocksManualOverlap = errorMatches(
    conflictAppointment.error,
    "appointment_public_hold_conflict",
  );
  await expireSessions([conflictSession]);

  const versionAppointmentId = `appointment-booking-db-version-${runId}`;
  appointmentIds.add(versionAppointmentId);
  const baseVersionRecord = appointmentRecord({
    bufferMinutes: 30,
    clientId,
    date: versionDay.date,
    id: versionAppointmentId,
    time: "06:00",
  });
  const createdAppointment = await saveAppointment(baseVersionRecord);
  if (createdAppointment.error) throw createdAppointment.error;
  const initialAppointment = await supabase
    .from("admin_appointments")
    .select("version")
    .eq("id", versionAppointmentId)
    .single();
  if (initialAppointment.error) throw initialAppointment.error;
  const updatedAppointment = await saveAppointment({
    ...baseVersionRecord,
    internal_note: "Updated once",
    version: initialAppointment.data.version,
  }, "appointment.update");
  if (updatedAppointment.error) throw updatedAppointment.error;
  const currentAppointment = await supabase
    .from("admin_appointments")
    .select("version")
    .eq("id", versionAppointmentId)
    .single();
  if (currentAppointment.error) throw currentAppointment.error;
  const staleAppointment = await saveAppointment({
    ...baseVersionRecord,
    internal_note: "Stale update",
    version: initialAppointment.data.version,
  }, "appointment.update");
  const staleAppointmentVersionRejected = currentAppointment.data.version === 2
    && errorMatches(staleAppointment.error, "appointment_concurrent_update");

  const concurrentContactReveals = await Promise.all(Array.from({ length: 61 }, () =>
    supabase.rpc("admin_reveal_appointment_contact", {
      p_actor_user_id: adminUserId,
      p_appointment_id: versionAppointmentId,
      p_purpose: "Booking DB smoke",
    })));
  const successfulContactReveals = concurrentContactReveals.filter((result) => !result.error).length;
  const limitedContactReveals = concurrentContactReveals.filter((result) =>
    errorMatches(result.error, "contact_reveal_rate_limited")
  ).length;
  const contactRevealRateLimitSerialized = successfulContactReveals === 60 && limitedContactReveals === 1;
  const contactRevealAlerts = await supabase
    .from("admin_security_alerts")
    .select("alert_type, metadata, severity")
    .eq("actor_user_id", adminUserId)
    .eq("alert_type", "bulk_contact_reveal");
  if (contactRevealAlerts.error) throw contactRevealAlerts.error;
  const securityAlertWarningCreated = contactRevealAlerts.data.length === 1
    && contactRevealAlerts.data[0].severity === "warning"
    && contactRevealAlerts.data[0].metadata?.contactRevealCount === 20
    && contactRevealAlerts.data[0].metadata?.windowMinutes === 10;

  const adjacentAppointmentId = `appointment-booking-db-adjacent-${runId}`;
  appointmentIds.add(adjacentAppointmentId);
  const adjacentAppointment = await saveAppointment(appointmentRecord({
    bufferMinutes: 30,
    clientId,
    date: versionDay.date,
    id: adjacentAppointmentId,
    time: "06:30",
  }));
  const manualBackToBackAllowed = !adjacentAppointment.error;

  const actualOverlapAppointmentId = `appointment-booking-db-actual-overlap-${runId}`;
  appointmentIds.add(actualOverlapAppointmentId);
  const actualOverlapAppointment = await saveAppointment(appointmentRecord({
    bufferMinutes: 30,
    clientId,
    date: versionDay.date,
    id: actualOverlapAppointmentId,
    time: "06:15",
  }));
  const manualActualOverlapRejected = errorMatches(
    actualOverlapAppointment.error,
    "appointment_overlap_conflict",
  );

  const defaultParallelId = `appointment-booking-db-default-specialist-${runId}`;
  const secondParallelId = `appointment-booking-db-second-specialist-${runId}`;
  appointmentIds.add(defaultParallelId);
  appointmentIds.add(secondParallelId);
  const defaultParallel = await saveAppointment(appointmentRecord({
    clientId,
    date: versionDay.date,
    id: defaultParallelId,
    specialistId: defaultSpecialist.data.id,
    time: "07:30",
  }));
  if (defaultParallel.error) throw defaultParallel.error;
  const secondParallel = await saveAppointment(appointmentRecord({
    clientId,
    date: versionDay.date,
    id: secondParallelId,
    specialistId: secondSpecialistId,
    time: "07:30",
  }));
  const crossSpecialistParallelAllowed = !secondParallel.error;

  const bufferedManualTime = versionDay.slots.find((time) =>
    versionDay.slots.includes(addMinutes(time, 30))
  );
  assert(bufferedManualTime, "Two consecutive public slots are required for the buffer smoke.");
  const manualBuffersStillBlockPublicHolds = [];
  for (const bufferMinutes of [15, 30]) {
    const bufferedAppointmentId = `appointment-booking-db-buffer-${bufferMinutes}-${runId}`;
    appointmentIds.add(bufferedAppointmentId);
    const bufferedAppointment = await saveAppointment(appointmentRecord({
      bufferMinutes,
      clientId,
      date: versionDay.date,
      id: bufferedAppointmentId,
      specialistId: defaultSpecialist.data.id,
      time: bufferedManualTime,
    }));
    if (bufferedAppointment.error) throw bufferedAppointment.error;

    const publicAvailabilityInsideBuffer = await supabase.rpc("public_booking_specialist_available", {
      p_buffer_minutes: settingsResult.data.booking_buffer_minutes,
      p_duration_minutes: variantResult.data.duration_minutes,
      p_excluded_hold_id: null,
      p_service_slug: serviceSlug,
      p_specialist_id: defaultSpecialist.data.id,
      p_starts_at: addMinutes(bufferedManualTime, 30),
      p_starts_on: versionDay.date,
    });
    if (publicAvailabilityInsideBuffer.error) throw publicAvailabilityInsideBuffer.error;
    manualBuffersStillBlockPublicHolds.push(
      publicAvailabilityInsideBuffer.data === false,
    );

    const removedBufferedAppointment = await supabase
      .from("admin_appointments")
      .delete()
      .eq("id", bufferedAppointmentId);
    if (removedBufferedAppointment.error) throw removedBufferedAppointment.error;
  }

  const blockStart = versionDay.slots[0];
  const blockEnd = addMinutes(blockStart, 30);
  const createdBlock = await mutateBlock({
    blockDate: versionDay.date,
    endsAt: blockEnd,
    specialistId: defaultSpecialist.data.id,
    startsAt: blockStart,
  });
  if (createdBlock.error) throw createdBlock.error;
  blockIds.add(createdBlock.data.id);
  const updatedBlock = await mutateBlock({
    blockDate: versionDay.date,
    blockId: createdBlock.data.id,
    endsAt: blockEnd,
    expectedVersion: createdBlock.data.version,
    note: "Updated once",
    specialistId: defaultSpecialist.data.id,
    startsAt: blockStart,
  });
  if (updatedBlock.error) throw updatedBlock.error;
  const staleBlock = await mutateBlock({
    blockDate: versionDay.date,
    blockId: createdBlock.data.id,
    endsAt: blockEnd,
    expectedVersion: createdBlock.data.version,
    note: "Stale update",
    specialistId: defaultSpecialist.data.id,
    startsAt: blockStart,
  });
  const staleBlockVersionRejected = updatedBlock.data.version === 2
    && errorMatches(staleBlock.error, "calendar_block_concurrent_update");

  const blockedSlot = await supabase.rpc("public_booking_specialist_available", {
    p_buffer_minutes: settingsResult.data.booking_buffer_minutes,
    p_duration_minutes: variantResult.data.duration_minutes,
    p_excluded_hold_id: null,
    p_service_slug: serviceSlug,
    p_specialist_id: defaultSpecialist.data.id,
    p_starts_at: blockStart,
    p_starts_on: versionDay.date,
  });
  if (blockedSlot.error) throw blockedSlot.error;
  const personalBlockRemovesSlot = blockedSlot.data === false;

  const capacitySession = opaqueHash(sessionHashes);
  const capacityToken = opaqueHash(tokenHashes);
  const capacityHold = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: capacitySession,
    time: capacityDay.slots[0],
    tokenHash: capacityToken,
  });
  if (capacityHold.error) throw capacityHold.error;
  const heldSnapshot = await supabase
    .from("public_booking_holds")
    .select("buffer_minutes, currency, duration_minutes, price_cents, specialist_id")
    .eq("token_hash", capacityToken)
    .single();
  if (heldSnapshot.error) throw heldSnapshot.error;
  const heldQuoteReturned = capacityHold.data.currency === heldSnapshot.data.currency
    && capacityHold.data.durationMinutes === heldSnapshot.data.duration_minutes
    && capacityHold.data.priceCents === heldSnapshot.data.price_cents;

  const specialistAppointments = await supabase
    .from("admin_appointments")
    .select("id", { count: "exact", head: true })
    .eq("specialist_id", heldSnapshot.data.specialist_id)
    .eq("starts_on", capacityDay.date)
    .neq("status", "cancelled");
  if (specialistAppointments.error) throw specialistAppointments.error;
  const specialistHolds = await supabase
    .from("public_booking_holds")
    .select("id")
    .eq("specialist_id", heldSnapshot.data.specialist_id)
    .eq("starts_on", capacityDay.date)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());
  if (specialistHolds.error) throw specialistHolds.error;
  const specialistReservedBefore = (specialistAppointments.count ?? 0) + specialistHolds.data.length;
  assert(
    specialistReservedBefore <= publicDailyLimit,
    "The assigned specialist already exceeds the public limit.",
  );

  const manualAppointmentIds = [];
  const manualAppointmentsToCap = publicDailyLimit - specialistReservedBefore;
  for (let index = 0; index < manualAppointmentsToCap; index += 1) {
    const id = `appointment-booking-db-manual-${runId}-${index}`;
    manualAppointmentIds.push(id);
    appointmentIds.add(id);
    const result = await saveAppointment(appointmentRecord({
      clientId,
      date: capacityDay.date,
      id,
      specialistId: heldSnapshot.data.specialist_id,
      time: addMinutes("00:00", index * 30),
    }));
    if (result.error) throw result.error;
  }

  const assignedSpecialistAvailability = await supabase.rpc("public_booking_specialist_available", {
    p_buffer_minutes: heldSnapshot.data.buffer_minutes,
    p_duration_minutes: heldSnapshot.data.duration_minutes,
    p_excluded_hold_id: null,
    p_service_slug: serviceSlug,
    p_specialist_id: heldSnapshot.data.specialist_id,
    p_starts_at: "23:00",
    p_starts_on: capacityDay.date,
  });
  if (assignedSpecialistAvailability.error) throw assignedSpecialistAvailability.error;
  const holdCountsTowardCap = assignedSpecialistAvailability.data === false;

  const manualOverflowTarget = publicDailyLimit + 1;
  for (let index = manualAppointmentIds.length; index < manualOverflowTarget; index += 1) {
    const id = `appointment-booking-db-manual-${runId}-${index}`;
    manualAppointmentIds.push(id);
    appointmentIds.add(id);
    const result = await saveAppointment(appointmentRecord({
      clientId,
      date: capacityDay.date,
      id,
      specialistId: heldSnapshot.data.specialist_id,
      time: addMinutes("00:00", index * 30),
    }));
    if (result.error) throw result.error;
  }
  const manualAppointments = await supabase
    .from("admin_appointments")
    .select("id", { count: "exact", head: true })
    .in("id", manualAppointmentIds);
  if (manualAppointments.error) throw manualAppointments.error;
  const manualAppointmentsBeforeConfirmation = manualAppointments.count === manualOverflowTarget;

  const idempotencyKeyHash = opaqueHash(idempotencyHashes);
  const parallelRestores = await Promise.all([
    supabase.rpc("public_booking_restore_session_hold_v4", {
      p_session_key_hash: capacitySession,
      p_token_hash: opaqueHash(tokenHashes),
    }),
    supabase.rpc("public_booking_restore_session_hold_v4", {
      p_session_key_hash: capacitySession,
      p_token_hash: opaqueHash(tokenHashes),
    }),
  ]);
  const parallelSessionRestoresSerialized = parallelRestores.every((result) => !result.error);
  const capacitySelectionVersion = capacityHold.data.selectionVersion;
  const parallelSessionVersionsStable = parallelRestores.every(
    (result) => result.data?.selectionId === capacityHold.data.selectionId
      && result.data?.selectionVersion === capacitySelectionVersion,
  );
  const firstConfirmation = await confirmBooking({
    careEmailOptIn: true,
    idempotencyKeyHash,
    phone,
    selectionId: capacityHold.data.selectionId,
    selectionVersion: capacitySelectionVersion,
    sessionKeyHash: capacitySession,
  });
  if (firstConfirmation.error) {
    throw new Error(`First session confirmation failed: ${firstConfirmation.error.message}`);
  }
  const secondConfirmation = await confirmBooking({
    careEmailOptIn: true,
    idempotencyKeyHash,
    phone,
    selectionId: capacityHold.data.selectionId,
    selectionVersion: capacitySelectionVersion,
    sessionKeyHash: capacitySession,
  });
  if (secondConfirmation.error) {
    throw new Error(`Idempotent session confirmation failed: ${secondConfirmation.error.message}`);
  }
  const restoredConfirmation = await supabase.rpc("public_booking_restore_session_confirmation", {
    p_session_key_hash: capacitySession,
  });
  if (restoredConfirmation.error) throw restoredConfirmation.error;

  const publicAppointment = await supabase
    .from("admin_appointments")
    .select(
      "id, client_id, client_name_snapshot, starts_on, starts_at, service_name, status, buffer_minutes, currency_snapshot, duration_minutes, internal_note, overlap_override, overlap_override_reason, overlap_overridden_at, overlap_overridden_by, post_visit_comment, post_visit_commented_at, price_cents_snapshot, public_contact_preference_snapshot, public_email_snapshot, public_phone_snapshot, version",
    )
    .eq("public_booking_idempotency_key_hash", idempotencyKeyHash)
    .single();
  if (publicAppointment.error) throw publicAppointment.error;
  appointmentIds.add(publicAppointment.data.id);
  clientIds.add(publicAppointment.data.client_id);

  const preservedClient = await supabase
    .from("admin_clients")
    .select(
      "care_email_consent_at, care_email_consent_email_hash, care_email_consent_source, care_email_withdrawn_at, email, full_name, locale, notes, phone, preferred_contact",
    )
    .eq("id", clientId)
    .single();
  if (preservedClient.error) throw preservedClient.error;

  const publicConfirmationAfterManualOverflow = firstConfirmation.data.status === "confirmed";
  const idempotentReferenceStable = secondConfirmation.data.publicReference
    === firstConfirmation.data.publicReference;
  const sessionConfirmationRestored = restoredConfirmation.data.publicReference
    === firstConfirmation.data.publicReference
    && restoredConfirmation.data.durationMinutes === heldSnapshot.data.duration_minutes
    && restoredConfirmation.data.priceCents === heldSnapshot.data.price_cents;
  const crmPreserved = preservedClient.data.full_name === "Existing CRM Name"
    && preservedClient.data.email === "existing-client@example.com"
    && preservedClient.data.locale === "bg"
    && preservedClient.data.notes === "Existing CRM note"
    && preservedClient.data.phone === `+${phone}`
    && preservedClient.data.preferred_contact === "telegram";
  const careEmailConsentBoundToSnapshot = preservedClient.data.care_email_consent_at !== null
    && preservedClient.data.care_email_consent_source === "public_booking"
    && preservedClient.data.care_email_consent_email_hash === hash("submitted-booking@example.com")
    && preservedClient.data.care_email_withdrawn_at === null;
  const bookingSnapshotsPreserved = publicAppointment.data.buffer_minutes
    === heldSnapshot.data.buffer_minutes
    && publicAppointment.data.currency_snapshot === heldSnapshot.data.currency
    && publicAppointment.data.duration_minutes === heldSnapshot.data.duration_minutes
    && publicAppointment.data.price_cents_snapshot === heldSnapshot.data.price_cents
    && publicAppointment.data.public_contact_preference_snapshot === "email"
    && publicAppointment.data.public_email_snapshot === "submitted-booking@example.com"
    && publicAppointment.data.public_phone_snapshot === `+${phone}`;
  const adjustedPublicDuration = publicAppointment.data.duration_minutes === 15
    ? 30
    : publicAppointment.data.duration_minutes - 15;
  const publicDurationSave = await saveAppointment({
    buffer_minutes: publicAppointment.data.buffer_minutes,
    client_id: publicAppointment.data.client_id,
    client_name_snapshot: publicAppointment.data.client_name_snapshot,
    duration_minutes: adjustedPublicDuration,
    id: publicAppointment.data.id,
    internal_note: publicAppointment.data.internal_note,
    overlap_override: publicAppointment.data.overlap_override,
    overlap_override_reason: publicAppointment.data.overlap_override_reason,
    overlap_overridden_at: publicAppointment.data.overlap_overridden_at,
    overlap_overridden_by: publicAppointment.data.overlap_overridden_by,
    post_visit_comment: publicAppointment.data.post_visit_comment,
    post_visit_commented_at: publicAppointment.data.post_visit_commented_at,
    service_name: publicAppointment.data.service_name,
    starts_at: publicAppointment.data.starts_at,
    starts_on: publicAppointment.data.starts_on,
    status: publicAppointment.data.status,
    version: publicAppointment.data.version,
  }, "appointment.resize");
  if (publicDurationSave.error) throw publicDurationSave.error;
  const adjustedPublicAppointment = await supabase
    .from("admin_appointments")
    .select(
      "buffer_minutes, currency_snapshot, duration_minutes, price_cents_snapshot, public_contact_preference_snapshot, public_email_snapshot, public_phone_snapshot, service_name",
    )
    .eq("id", publicAppointment.data.id)
    .single();
  if (adjustedPublicAppointment.error) throw adjustedPublicAppointment.error;
  const publicDurationAdjusted = adjustedPublicAppointment.data.duration_minutes === adjustedPublicDuration
    && adjustedPublicAppointment.data.buffer_minutes === publicAppointment.data.buffer_minutes
    && adjustedPublicAppointment.data.currency_snapshot === publicAppointment.data.currency_snapshot
    && adjustedPublicAppointment.data.price_cents_snapshot === publicAppointment.data.price_cents_snapshot
    && adjustedPublicAppointment.data.public_contact_preference_snapshot
      === publicAppointment.data.public_contact_preference_snapshot
    && adjustedPublicAppointment.data.public_email_snapshot === publicAppointment.data.public_email_snapshot
    && adjustedPublicAppointment.data.public_phone_snapshot === publicAppointment.data.public_phone_snapshot
    && adjustedPublicAppointment.data.service_name === publicAppointment.data.service_name;

  const enableSecondSpecialist = await supabase
    .from("admin_specialists")
    .update({ public_booking_enabled: true })
    .eq("id", secondSpecialistId);
  if (enableSecondSpecialist.error) throw enableSecondSpecialist.error;

  const [defaultAvailability, secondAvailability] = await Promise.all([
    supabase.rpc("public_booking_get_availability_v3", {
      p_days: 31,
      p_from: sofiaToday(),
      p_price_variant_id: priceVariantId,
      p_specialist_slug: defaultSpecialist.data.public_slug,
    }),
    supabase.rpc("public_booking_get_availability_v3", {
      p_days: 31,
      p_from: sofiaToday(),
      p_price_variant_id: priceVariantId,
      p_specialist_slug: secondSpecialistSlug,
    }),
  ]);
  if (defaultAvailability.error) throw defaultAvailability.error;
  if (secondAvailability.error) throw secondAvailability.error;
  const secondSlotsByDate = new Map(
    secondAvailability.data.days.map((day) => [day.date, new Set(day.slots)]),
  );
  const sharedCandidate = defaultAvailability.data.days
    .flatMap((day) => day.slots
      .filter((slot) => secondSlotsByDate.get(day.date)?.has(slot))
      .map((slot) => ({ date: day.date, time: slot })))
    .at(0);
  assert(sharedCandidate, "A slot shared by two public specialists is required for the DB smoke.");

  const specificSession = opaqueHash(sessionHashes);
  const fallbackSession = opaqueHash(sessionHashes);
  const specificHold = await createHold({
    date: sharedCandidate.date,
    priceVariantId,
    sessionKeyHash: specificSession,
    specialistSlug: defaultSpecialist.data.public_slug,
    time: sharedCandidate.time,
    tokenHash: opaqueHash(tokenHashes),
  });
  if (specificHold.error) throw specificHold.error;
  const occupiedSpecificSession = opaqueHash(sessionHashes);
  const occupiedSpecificHold = await createHold({
    date: sharedCandidate.date,
    priceVariantId,
    sessionKeyHash: occupiedSpecificSession,
    specialistSlug: defaultSpecialist.data.public_slug,
    time: sharedCandidate.time,
    tokenHash: opaqueHash(tokenHashes),
  });
  const occupiedSpecificSpecialistRejected = errorMatches(
    occupiedSpecificHold.error,
    "slot_unavailable",
  );
  const fallbackHold = await createHold({
    date: sharedCandidate.date,
    priceVariantId,
    sessionKeyHash: fallbackSession,
    time: sharedCandidate.time,
    tokenHash: opaqueHash(tokenHashes),
  });
  if (fallbackHold.error) throw fallbackHold.error;
  const specificSpecialistPreserved = specificHold.data.specialistId === defaultSpecialist.data.public_slug;
  const blockedSpecialistFallsBack = fallbackHold.data.specialistId !== defaultSpecialist.data.public_slug;
  const publicSpecialistUuidHidden = options.services.every((service) =>
    service.specialists.every((specialist) =>
      typeof specialist.id === "string"
      && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(specialist.id)
    )
  ) && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(specificHold.data.specialistId);
  await expireSessions([specificSession, occupiedSpecificSession, fallbackSession]);

  const parallelSpecialistSessions = [opaqueHash(sessionHashes), opaqueHash(sessionHashes)];
  const parallelSpecialistHolds = await Promise.all(
    parallelSpecialistSessions.map((sessionKeyHash) => createHold({
      date: sharedCandidate.date,
      priceVariantId,
      sessionKeyHash,
      time: sharedCandidate.time,
      tokenHash: opaqueHash(tokenHashes),
    })),
  );
  const parallelSpecialistsDistributed = parallelSpecialistHolds.every((result) => !result.error)
    && new Set(parallelSpecialistHolds.map((result) => result.data.specialistId)).size === 2;
  await expireSessions(parallelSpecialistSessions);

  output = {
    blockedSpecialistFallsBack,
    careEmailConsentBoundToSnapshot,
    contactRevealRateLimitSerialized,
    bookingSnapshotsPreserved,
    concurrentSlotSerialized,
    crossSpecialistParallelAllowed,
    crmPreserved,
    dailyLimitSynchronized,
    halfHourGridEnforced,
    holdBlocksManualOverlap,
    holdCountsTowardCap,
    heldQuoteReturned,
    idempotentReferenceStable,
    inactiveSessionReleased,
    manualAppointmentsBeforeConfirmation,
    manualActualOverlapRejected,
    manualBackToBackAllowed,
    manualBuffersStillBlockPublicHolds: manualBuffersStillBlockPublicHolds.every(Boolean),
    newServiceAutoAssigned,
    obsoleteConfirmRpcRemoved,
    obsoleteHoldRpcRemoved,
    occupiedSpecificSpecialistRejected,
    offGridStartRejected,
    personalBlockRemovesSlot,
    parallelSessionRestoresSerialized: parallelSessionRestoresSerialized
      && parallelSessionVersionsStable,
    parallelSpecialistsDistributed,
    publicSpecialistUuidHidden,
    publicConfirmationAfterManualOverflow,
    publicDurationAdjusted,
    securityAlertWarningCreated,
    scheduleVersionAdvanced,
    sessionHoldRestored,
    sessionHoldReplaced,
    sessionConfirmationRestored,
    staleSelectionIdentityRejected,
    staleSelectionVersionRejected,
    staleAppointmentVersionRejected,
    staleBlockVersionRejected,
    staleSpecialistScheduleRejected,
    specialistScheduleAllowsRestoredSlot,
    specialistScheduleRejectsClosedSlot,
    specialistArbitraryClientRejected,
    specialistAssignedClientRejected,
    specificSpecialistPreserved,
    settingsCannotOverwriteScheduleEnvelope,
  };

  for (const [name, passed] of Object.entries(output)) {
    assert(passed, `Booking DB smoke failed: ${name}`);
  }
} finally {
  await cleanup();
}

console.log(JSON.stringify(output, null, 2));
