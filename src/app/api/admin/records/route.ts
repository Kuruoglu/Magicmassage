import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { isAdminPersistInput, persistAdminRecord } from "@/admin/persistence";
import type { AdminAuditAction, AdminPersistInput } from "@/admin/persistence";
import type { AdminRoleId } from "@/admin/config";
import { isAdminDemoFallbackAllowed } from "@/admin/data-source";
import { runWithAdminRepositoryAuditContext } from "@/admin/repository";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
  resolveSupabaseAdminEnv,
  type SupabaseAdminClient,
} from "@/lib/supabase/admin";
import { resolveAdminSupabaseEnv } from "@/admin/supabase-client";

const recordWriteRoles: Record<AdminPersistInput["type"], AdminRoleId[]> = {
  appointment: ["owner", "administrator"],
  blogPost: ["owner", "administrator", "editor"],
  certificate: ["owner", "administrator"],
  client: ["owner", "administrator"],
  contactChannel: ["owner", "administrator", "editor"],
  contactSettings: ["owner", "administrator", "editor"],
  media: ["owner", "administrator", "editor"],
  price: ["owner", "administrator", "editor"],
  service: ["owner", "administrator", "editor"],
  settings: ["owner"],
};

const publicLocales = ["bg", "ru", "ua", "en"] as const;
const activeAppointmentStatuses = new Set(["confirmed", "pending", "request"]);
const activeAppointmentLabels = new Set([
  "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430",
  "\u041e\u0436\u0438\u0434\u0430\u0435\u0442",
  "\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u044f\u0432\u043a\u0430",
]);
const completedAppointmentStatuses = new Set(["completed", "no_show"]);
const publicShellPageSuffixes = [
  "",
  "/about",
  "/blog",
  "/booking",
  "/contacts",
  "/cookies",
  "/gift-certificates",
  "/privacy",
  "/services",
  "/terms",
] as const;
const cancelledAppointmentStatus = "\u041e\u0442\u043c\u0435\u043d\u0435\u043d\u0430";
const nataliSpecialistId = "00000000-0000-4000-8000-000000000001";
const publishedStatus = "\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u0430";
const scheduledStatus = "\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0430";
const weekdayByToken: Record<string, number> = {
  mon: 1,
  monday: 1,
  sat: 6,
  saturday: 6,
  sun: 0,
  sunday: 0,
  thu: 4,
  thursday: 4,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  fri: 5,
  friday: 5,
  "\u0432\u0441": 0,
  "\u0432\u0442": 2,
  "\u043d\u0434": 0,
  "\u043f\u043d": 1,
  "\u043f\u043e\u043d": 1,
  "\u043f\u0442": 5,
  "\u0441\u0431": 6,
  "\u0441\u0440": 3,
  "\u0447\u0442": 4,
};

type AppointmentScheduleRow = {
  duration_minutes: number;
  id: string;
  specialist_id?: string | null;
  starts_at: string;
  status: string;
};

type CurrentAppointmentRow = {
  buffer_minutes?: number;
  duration_minutes?: number;
  id: string;
  origin?: string;
  post_visit_comment: string;
  specialist_id?: string | null;
  starts_at: string;
  starts_on: string;
  status: string;
  version: number;
};

type CalendarBlockRow = {
  ends_at: string;
  specialist_id?: string | null;
  starts_at: string;
};

const auditActionByRecordType: Record<Exclude<AdminPersistInput["type"], "appointment">, string> = {
  blogPost: "blog.publication",
  certificate: "record.certificate.upsert",
  client: "record.client.upsert",
  contactChannel: "record.contactChannel.upsert",
  contactSettings: "record.contactSettings.upsert",
  media: "media.asset",
  price: "record.price.upsert",
  service: "service.visibility",
  settings: "site.gift_certificates",
};

type AppointmentSettingsRow = {
  booking_buffer_minutes: number;
  timezone: string;
};

type SpecialistScheduleRow = {
  weekly_schedule: Array<{
    endsAt: string;
    isWorking: boolean;
    startsAt: string;
    weekday: number;
  }>;
};

type PublicationMediaRow = {
  alt_text: string;
  media_type: string;
  publication_consent_status: string;
  status: string;
};

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function weekdayInTimeZone(date: string, timeZone: string) {
  const label = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
    .format(new Date(`${date}T12:00:00Z`));
  const day = weekdayByToken[label.toLowerCase()];
  if (day === undefined) throw new Error("invalid appointment timezone");

  return day === 0 ? 7 : day;
}

function isOutsideSpecialistSchedule(
  schedule: SpecialistScheduleRow["weekly_schedule"],
  date: string,
  start: number,
  duration: number,
  timeZone: string,
) {
  if (!Array.isArray(schedule)) throw new Error("specialist schedule is invalid");

  const day = schedule.find((candidate) => candidate.weekday === weekdayInTimeZone(date, timeZone));
  if (
    !day ||
    typeof day.isWorking !== "boolean" ||
    typeof day.startsAt !== "string" ||
    typeof day.endsAt !== "string"
  ) {
    throw new Error("specialist schedule is invalid");
  }
  if (!day.isWorking) return true;

  const startsAt = timeToMinutes(day.startsAt);
  const endsAt = timeToMinutes(day.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) {
    throw new Error("specialist schedule is invalid");
  }

  return start < startsAt || start + duration > endsAt;
}

function localDateTimeInTimeZone(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${String(Number(parts.hour) % 24).padStart(2, "0")}:${parts.minute}`;
}

function needsPublicationCover(payload: AdminPersistInput) {
  return (payload.type === "service" && payload.record.status === publishedStatus) ||
    (payload.type === "blogPost" &&
      (payload.record.status === publishedStatus || payload.record.status === scheduledStatus));
}

async function hasValidPublicationCover(client: SupabaseAdminClient, payload: AdminPersistInput) {
  if (!needsPublicationCover(payload) || (payload.type !== "service" && payload.type !== "blogPost")) return true;
  const result = await client
    .from("admin_media_assets")
    .select("alt_text, media_type, publication_consent_status, status")
    .eq("url", payload.record.coverImage);

  if (result.error) throw new Error("publication media verification failed");

  return ((result.data ?? []) as PublicationMediaRow[]).some((media) =>
    media.media_type === "photo" &&
    media.status === "ready" &&
    typeof media.alt_text === "string" &&
    Boolean(media.alt_text.trim()) &&
    ["granted", "not_required"].includes(media.publication_consent_status),
  );
}

function deriveAppointmentAuditAction(
  payload: Extract<AdminPersistInput, { type: "appointment" }>,
  currentAppointment: CurrentAppointmentRow | null,
): AdminAuditAction {
  if (!currentAppointment) return "appointment.create";
  if (payload.record.status === cancelledAppointmentStatus && currentAppointment.status !== "cancelled") {
    return "appointment.cancel";
  }

  const previousComment = currentAppointment.post_visit_comment?.trim() ?? "";
  const nextComment = payload.record.postVisitComment?.trim() ?? "";

  if (previousComment !== nextComment) return "appointment.post_visit_comment";
  if (
    currentAppointment.starts_on !== payload.record.date ||
    currentAppointment.starts_at.slice(0, 5) !== payload.record.time
  ) {
    return "appointment.drag";
  }
  if (
    currentAppointment.duration_minutes !== undefined &&
    currentAppointment.duration_minutes !== (payload.record.durationMinutes ?? 60)
  ) {
    return "appointment.resize";
  }

  return "appointment.update";
}

async function classifyAppointmentOnServer(
  client: SupabaseAdminClient,
  payload: Extract<AdminPersistInput, { type: "appointment" }>,
  authorizedSpecialistId?: string,
) {
  const currentAppointmentQuery = payload.record.id
    ? (() => {
        let query = client
          .from("admin_appointments")
          .select("buffer_minutes, duration_minutes, id, origin, post_visit_comment, specialist_id, starts_at, starts_on, status, version")
          .eq("id", payload.record.id);

        if (authorizedSpecialistId) {
          query = query.eq("specialist_id", authorizedSpecialistId);
        }

        return query;
      })()
    : Promise.resolve({ data: [], error: null });
  const [appointmentsResult, blocksResult, currentAppointmentResult, settingsResult] = await Promise.all([
    client
      .from("admin_appointments")
      .select("duration_minutes, id, specialist_id, starts_at, status")
      .eq("starts_on", payload.record.date),
    client
      .from("admin_calendar_blocks")
      .select("ends_at, specialist_id, starts_at")
      .eq("block_date", payload.record.date),
    currentAppointmentQuery,
    client
      .from("admin_site_settings")
      .select("booking_buffer_minutes, timezone")
      .eq("id", "site"),
  ]);

  if (appointmentsResult.error || blocksResult.error || currentAppointmentResult.error || settingsResult.error) {
    throw new Error("appointment schedule verification failed");
  }

  const settings = (settingsResult.data?.[0] ?? null) as AppointmentSettingsRow | null;
  if (!settings || !Number.isInteger(settings.booking_buffer_minutes) || settings.booking_buffer_minutes < 0) {
    throw new Error("appointment settings are invalid");
  }
  const currentAppointment = ((currentAppointmentResult.data ?? [])[0] ?? null) as CurrentAppointmentRow | null;
  const effectiveSpecialistId = authorizedSpecialistId ??
    payload.record.specialistId ??
    currentAppointment?.specialist_id ??
    nataliSpecialistId;
  const duration = payload.record.durationMinutes ?? currentAppointment?.duration_minutes ?? 60;
  const specialistResult = await client
    .from("admin_specialists")
    .select("weekly_schedule")
    .eq("id", effectiveSpecialistId);
  if (specialistResult.error) {
    throw new Error("appointment specialist schedule verification failed");
  }
  const specialistSchedule = ((specialistResult.data ?? [])[0] ?? null) as SpecialistScheduleRow | null;
  if (!specialistSchedule) throw new Error("appointment specialist schedule is missing");
  const start = timeToMinutes(payload.record.time);
  const buffer = currentAppointment && Number.isInteger(currentAppointment.buffer_minutes)
    ? currentAppointment!.buffer_minutes!
    : settings.booking_buffer_minutes;
  const rows = (appointmentsResult.data ?? []) as AppointmentScheduleRow[];
  const blocks = (blocksResult.data ?? []) as CalendarBlockRow[];
  const overlap = activeAppointmentLabels.has(payload.record.status) && rows.some((candidate) => {
    if (candidate.id === payload.record.id || !activeAppointmentStatuses.has(candidate.status)) return false;
    if ((candidate.specialist_id ?? nataliSpecialistId) !== effectiveSpecialistId) return false;
    const candidateStart = timeToMinutes(candidate.starts_at);

    return start < candidateStart + candidate.duration_minutes &&
      candidateStart < start + duration;
  });
  const blockConflict = activeAppointmentLabels.has(payload.record.status) && blocks.some((block) => {
    if ((block.specialist_id ?? nataliSpecialistId) !== effectiveSpecialistId) return false;
    const blockStart = timeToMinutes(block.starts_at);
    const blockEnd = timeToMinutes(block.ends_at);

    return start < blockEnd && blockStart < start + duration + buffer;
  });
  const outsideWorkingHours = isOutsideSpecialistSchedule(
    specialistSchedule.weekly_schedule,
    payload.record.date,
    start,
    duration,
    settings.timezone,
  );
  const previousComment = currentAppointment?.post_visit_comment?.trim() ?? "";
  const nextComment = payload.record.postVisitComment?.trim() ?? "";
  const appointmentStart = currentAppointment
    ? `${currentAppointment.starts_on}T${currentAppointment.starts_at.slice(0, 5)}`
    : `${payload.record.date}T${payload.record.time}`;
  const appointmentStatus = currentAppointment?.status ?? "pending";
  const postVisitCommentBlocked = previousComment !== nextComment &&
    !completedAppointmentStatuses.has(appointmentStatus) &&
    appointmentStart > localDateTimeInTimeZone(new Date(), settings.timezone);

  return {
    auditAction: deriveAppointmentAuditAction({
      ...payload,
      record: { ...payload.record, durationMinutes: duration },
    }, currentAppointment),
    blockConflict,
    buffer,
    duration,
    effectiveSpecialistId,
    outsideWorkingHours,
    overlap,
    postVisitCommentBlocked,
  };
}

function revalidatePublicContent(payload: AdminPersistInput) {
  if (payload.type === "settings") {
    for (const locale of publicLocales) {
      for (const suffix of publicShellPageSuffixes) {
        revalidatePath(`/${locale}${suffix}`);
      }
    }

    revalidatePath("/[locale]/blog/[slug]", "layout");
    revalidatePath("/[locale]/services/[serviceSlug]", "page");
    revalidatePath("/sitemap.xml");
    return;
  }

  for (const locale of publicLocales) {
    if (payload.type === "service") {
      revalidatePath(`/${locale}`);
      revalidatePath(`/${locale}/services`);
      revalidatePath(`/${locale}/services/${payload.record.slug}`);
    } else if (payload.type === "blogPost") {
      revalidatePath(`/${locale}/blog`);
      revalidatePath(`/${locale}/blog/${payload.record.slug}`);
    } else if (payload.type === "media") {
      revalidatePath(`/${locale}`, "layout");
    }
  }
}

function auditMetadata(payload: AdminPersistInput, role: AdminRoleId) {
  return {
    role,
    ...(payload.audit?.outsideWorkingHours !== undefined
      ? { outsideWorkingHours: payload.audit.outsideWorkingHours }
      : {}),
    ...(payload.audit?.overlapOverride !== undefined
      ? { overlapOverride: payload.audit.overlapOverride }
      : {}),
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid admin record payload." }, { status: 400 });
  }

  if (!isAdminPersistInput(payload)) {
    return NextResponse.json({ error: "Invalid admin record payload." }, { status: 400 });
  }

  const supabaseAdminClient = createSupabaseAdminClient();
  let actor: { role: AdminRoleId; specialistId?: string; userId: string } | undefined;

  if (supabaseAdminClient) {
    const authorization = await authorizeSupabaseAdminAccess(
      supabaseAdminClient,
      getBearerToken(request.headers.get("authorization")),
      { allowedRoles: recordWriteRoles[payload.type] },
    );

    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.statusCode });
    }

    if (!recordWriteRoles[payload.type].includes(authorization.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    actor = {
      role: authorization.role,
      specialistId: authorization.specialistId,
      userId: authorization.userId,
    };
    if (actor.role === "specialist" && !actor.specialistId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!isAdminDemoFallbackAllowed()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (resolveAdminSupabaseEnv() && !resolveSupabaseAdminEnv()) {
    return NextResponse.json(
      {
        message: "SUPABASE_SECRET_KEY is required before writing admin records to Supabase.",
        mode: "supabase",
        ok: false,
      },
      { status: 500 },
    );
  }

  let verifiedPayload = payload;
  let auditAction = payload.type === "appointment"
    ? "appointment.update"
    : auditActionByRecordType[payload.type];

  if (supabaseAdminClient && needsPublicationCover(payload)) {
    try {
      if (!(await hasValidPublicationCover(supabaseAdminClient, payload))) {
        return NextResponse.json(
          { error: "Published content requires a ready, consented photo from the media library with alt text." },
          { status: 409 },
        );
      }
    } catch {
      console.error("Admin publication media verification failed");
      return NextResponse.json({ error: "Could not verify publication media." }, { status: 500 });
    }
  }

  if (payload.type === "appointment" && supabaseAdminClient) {
    try {
      const classification = await classifyAppointmentOnServer(
        supabaseAdminClient,
        payload,
        actor?.role === "specialist" ? actor.specialistId : undefined,
      );

      if (classification.blockConflict) {
        return NextResponse.json(
          { error: "Appointment conflicts with blocked personal time." },
          { status: 409 },
        );
      }

      if (classification.postVisitCommentBlocked) {
        return NextResponse.json(
          { error: "Post-visit comments cannot be changed before a future appointment is completed." },
          { status: 409 },
        );
      }

      if (classification.overlap !== Boolean(payload.record.overlapOverride)) {
        return NextResponse.json(
          { error: classification.overlap ? "Appointment overlap requires an explicit override." : "Invalid overlap override." },
          { status: classification.overlap ? 409 : 400 },
        );
      }

      auditAction = classification.auditAction;

      verifiedPayload = {
        ...payload,
        record: {
          ...payload.record,
          bufferMinutes: classification.buffer,
          durationMinutes: classification.duration,
          ...(actor?.role === "specialist"
            ? { specialistId: classification.effectiveSpecialistId }
            : {}),
        },
        audit: {
          ...payload.audit!,
          action: classification.auditAction,
          outsideWorkingHours: classification.outsideWorkingHours,
          overlapOverride: classification.overlap,
        },
      };
    } catch {
      console.error("Admin appointment schedule verification failed");
      return NextResponse.json({ error: "Could not verify appointment schedule." }, { status: 500 });
    }
  }

  if (
    verifiedPayload.type === "appointment" &&
    verifiedPayload.record.overlapOverride &&
    verifiedPayload.audit?.overlapOverride !== true
  ) {
    return NextResponse.json({ error: "An overlap override must be explicitly authorized." }, { status: 400 });
  }

  if (
    verifiedPayload.type === "appointment" &&
    verifiedPayload.audit?.overlapOverride &&
    actor &&
    actor.role !== "owner" &&
    actor.role !== "administrator"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const persistPayload: AdminPersistInput =
    verifiedPayload.type === "appointment" && verifiedPayload.audit?.overlapOverride && actor
      ? {
          ...verifiedPayload,
          record: {
            ...verifiedPayload.record,
            overlapOverride: true,
            overlapOverriddenBy: actor.userId,
          },
        }
      : verifiedPayload;
  const persistOperation = () => persistAdminRecord(persistPayload);
  const result = actor
    ? await runWithAdminRepositoryAuditContext(
        {
          action: auditAction,
          actorUserId: actor.userId,
          metadata: auditMetadata(persistPayload, actor.role),
        },
        persistOperation,
      )
    : await persistOperation();
  if (result.ok) {
    revalidatePublicContent(persistPayload);
  }

  if (!result.ok && result.reason) {
    const conflictMessage = result.reason === "appointment_calendar_block_conflict"
      ? "Appointment conflicts with blocked personal time."
      : result.reason === "appointment_concurrent_update"
        ? "Appointment changed while it was being saved. Reload and try again."
        : result.reason === "appointment_public_hold_conflict"
          ? "This time is temporarily held by an online customer. Choose another time."
          : result.reason === "appointment_overlap_conflict"
            ? "Appointment overlaps another active appointment."
            : "Public booking service and booking snapshots cannot be changed.";

    return NextResponse.json({ error: conflictMessage }, { status: 409 });
  }

  const responseResult = result.ok && persistPayload.type === "appointment"
    ? { ...result, version: (persistPayload.record.version ?? 0) + 1 }
    : result;

  return NextResponse.json(
    responseResult.ok ? responseResult : { ...responseResult, message: "Не удалось сохранить изменения. Повторите попытку." },
    { status: result.ok || result.mode === "demo" ? 200 : 500 },
  );
}
