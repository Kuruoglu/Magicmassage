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
const runId = randomUUID().replaceAll("-", "");
let adminUserId;

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
    starts_at: time,
    starts_on: date,
    status,
    version,
  };
}

async function createHold({ date, priceVariantId, sessionKeyHash, time, tokenHash }) {
  return supabase.rpc("public_booking_create_hold_v4", {
    p_price_variant_id: priceVariantId,
    p_session_key_hash: sessionKeyHash,
    p_starts_at: time,
    p_starts_on: date,
    p_token_hash: tokenHash,
  });
}

async function saveAppointment(record, action = "appointment.create") {
  return supabase.rpc("admin_save_appointment_with_audit", {
    p_action: action,
    p_actor_user_id: adminUserId,
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
}) {
  return supabase.rpc("admin_mutate_calendar_block", {
    p_action: action,
    p_actor_user_id: adminUserId,
    p_block_date: blockDate,
    p_block_id: blockId,
    p_ends_at: endsAt,
    p_expected_version: expectedVersion,
    p_internal_note: note,
    p_kind: "personal",
    p_starts_at: startsAt,
  });
}

async function confirmBooking({ idempotencyKeyHash, phone, selectionId, selectionVersion, sessionKeyHash }) {
  return supabase.rpc("public_booking_confirm_session_v4", {
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

  if (cleanupErrors.length > 0) {
    throw new Error(`Booking DB smoke cleanup failed: ${cleanupErrors.map((error) => error.message).join("; ")}`);
  }
}

let output;

try {
  const { data: options, error: optionsError } = await supabase.rpc("public_booking_get_options", {
    p_locale: "en",
  });
  if (optionsError) throw optionsError;
  const priceVariantId = options?.services?.[0]?.variants?.[0]?.id;
  assert(typeof priceVariantId === "string", "No public booking price variant is available.");

  const settingsResult = await supabase
    .from("admin_site_settings")
    .select("booking_min_lead_minutes, booking_slot_step_minutes, public_booking_daily_limit, public_booking_enabled")
    .eq("id", "site")
    .single();
  if (settingsResult.error) throw settingsResult.error;
  assert(settingsResult.data.public_booking_enabled, "Public booking must be enabled for the DB smoke.");
  assert(settingsResult.data.public_booking_daily_limit === 8, "Public booking daily limit must be 8.");
  assert(settingsResult.data.booking_slot_step_minutes === 30, "Public booking slot step must be 30 minutes.");
  assert(settingsResult.data.booking_min_lead_minutes === 30, "Public booking same-day lead must be 30 minutes.");

  const { data: availability, error: availabilityError } = await supabase.rpc(
    "public_booking_get_availability",
    { p_days: 31, p_from: sofiaToday(), p_price_variant_id: priceVariantId },
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
  const conflictAppointmentId = `appointment-booking-db-conflict-${runId}`;
  appointmentIds.add(conflictAppointmentId);
  const conflictAppointment = await saveAppointment(appointmentRecord({
    clientId,
    date: capacityDay.date,
    id: conflictAppointmentId,
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
      time: bufferedManualTime,
    }));
    if (bufferedAppointment.error) throw bufferedAppointment.error;

    const publicHoldInsideBuffer = await createHold({
      date: versionDay.date,
      priceVariantId,
      sessionKeyHash: opaqueHash(sessionHashes),
      time: addMinutes(bufferedManualTime, 30),
      tokenHash: opaqueHash(tokenHashes),
    });
    manualBuffersStillBlockPublicHolds.push(
      errorMatches(publicHoldInsideBuffer.error, "slot_unavailable"),
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
    startsAt: blockStart,
  });
  if (updatedBlock.error) throw updatedBlock.error;
  const staleBlock = await mutateBlock({
    blockDate: versionDay.date,
    blockId: createdBlock.data.id,
    endsAt: blockEnd,
    expectedVersion: createdBlock.data.version,
    note: "Stale update",
    startsAt: blockStart,
  });
  const staleBlockVersionRejected = updatedBlock.data.version === 2
    && errorMatches(staleBlock.error, "calendar_block_concurrent_update");

  const blockedSlot = await createHold({
    date: versionDay.date,
    priceVariantId,
    sessionKeyHash: opaqueHash(sessionHashes),
    time: blockStart,
    tokenHash: opaqueHash(tokenHashes),
  });
  const personalBlockRemovesSlot = errorMatches(blockedSlot.error, "slot_unavailable");

  const existingAppointments = await supabase
    .from("admin_appointments")
    .select("id", { count: "exact", head: true })
    .eq("starts_on", capacityDay.date)
    .neq("status", "cancelled");
  if (existingAppointments.error) throw existingAppointments.error;
  const existingHolds = await supabase
    .from("public_booking_holds")
    .select("id")
    .eq("starts_on", capacityDay.date)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());
  if (existingHolds.error) throw existingHolds.error;
  const reservedBefore = (existingAppointments.count ?? 0) + existingHolds.data.length;
  assert(reservedBefore < 8, "The capacity smoke date is already at its public limit.");

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
    .select("buffer_minutes, currency, duration_minutes, price_cents")
    .eq("token_hash", capacityToken)
    .single();
  if (heldSnapshot.error) throw heldSnapshot.error;
  const heldQuoteReturned = capacityHold.data.currency === heldSnapshot.data.currency
    && capacityHold.data.durationMinutes === heldSnapshot.data.duration_minutes
    && capacityHold.data.priceCents === heldSnapshot.data.price_cents;

  const manualAppointmentIds = [];
  const manualAppointmentsToCap = 8 - reservedBefore - 1;
  for (let index = 0; index < manualAppointmentsToCap; index += 1) {
    const id = `appointment-booking-db-manual-${runId}-${index}`;
    manualAppointmentIds.push(id);
    appointmentIds.add(id);
    const result = await saveAppointment(appointmentRecord({
      clientId,
      date: capacityDay.date,
      id,
      time: addMinutes("00:00", index * 30),
    }));
    if (result.error) throw result.error;
  }

  const capacityContender = await createHold({
    date: capacityDay.date,
    priceVariantId,
    sessionKeyHash: opaqueHash(sessionHashes),
    time: capacityDay.slots[1],
    tokenHash: opaqueHash(tokenHashes),
  });
  const holdCountsTowardCap = errorMatches(capacityContender.error, "cap_reached");

  for (let index = manualAppointmentIds.length; index < 9; index += 1) {
    const id = `appointment-booking-db-manual-${runId}-${index}`;
    manualAppointmentIds.push(id);
    appointmentIds.add(id);
    const result = await saveAppointment(appointmentRecord({
      clientId,
      date: capacityDay.date,
      id,
      time: addMinutes("00:00", index * 30),
    }));
    if (result.error) throw result.error;
  }
  const manualAppointments = await supabase
    .from("admin_appointments")
    .select("id", { count: "exact", head: true })
    .in("id", manualAppointmentIds);
  if (manualAppointments.error) throw manualAppointments.error;
  const manualAppointmentsBeforeConfirmation = manualAppointments.count === 9;

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
      "id, client_id, buffer_minutes, currency_snapshot, duration_minutes, price_cents_snapshot, public_contact_preference_snapshot, public_email_snapshot, public_phone_snapshot",
    )
    .eq("public_booking_idempotency_key_hash", idempotencyKeyHash)
    .single();
  if (publicAppointment.error) throw publicAppointment.error;
  appointmentIds.add(publicAppointment.data.id);
  clientIds.add(publicAppointment.data.client_id);

  const preservedClient = await supabase
    .from("admin_clients")
    .select("email, full_name, locale, notes, phone, preferred_contact")
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
  const bookingSnapshotsPreserved = publicAppointment.data.buffer_minutes
    === heldSnapshot.data.buffer_minutes
    && publicAppointment.data.currency_snapshot === heldSnapshot.data.currency
    && publicAppointment.data.duration_minutes === heldSnapshot.data.duration_minutes
    && publicAppointment.data.price_cents_snapshot === heldSnapshot.data.price_cents
    && publicAppointment.data.public_contact_preference_snapshot === "email"
    && publicAppointment.data.public_email_snapshot === "submitted-booking@example.com"
    && publicAppointment.data.public_phone_snapshot === `+${phone}`;

  output = {
    bookingSnapshotsPreserved,
    concurrentSlotSerialized,
    crmPreserved,
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
    obsoleteConfirmRpcRemoved,
    obsoleteHoldRpcRemoved,
    offGridStartRejected,
    personalBlockRemovesSlot,
    parallelSessionRestoresSerialized: parallelSessionRestoresSerialized
      && parallelSessionVersionsStable,
    publicConfirmationAfterManualOverflow,
    sessionHoldRestored,
    sessionHoldReplaced,
    sessionConfirmationRestored,
    staleSelectionIdentityRejected,
    staleSelectionVersionRejected,
    staleAppointmentVersionRejected,
    staleBlockVersionRejected,
  };

  for (const [name, passed] of Object.entries(output)) {
    assert(passed, `Booking DB smoke failed: ${name}`);
  }
} finally {
  await cleanup();
}

console.log(JSON.stringify(output, null, 2));
