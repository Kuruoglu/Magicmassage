"use client";

import Link from "next/link";
import { useState } from "react";

import type { AdminRoleId } from "@/admin/config";
import type { Appointment, ClientRecord } from "@/admin/domain";
import type { AdminAuditAction } from "@/admin/persistence";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerHeader,
  AdminDrawerSection,
} from "@/components/admin/drawer";
import { isPostVisitCommentAvailable } from "@/components/admin/clients/visit-comments";
import { statusClass } from "@/components/admin/lib/formatters";
import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";
import {
  calendarClientHref,
  calendarCreateHref,
  certificateClientHref,
  clientProfileHref,
} from "@/components/admin/lib/links";

import { formatCalendarDay } from "./format";
import type { CalendarAppointmentSaveResult } from "./CalendarWorkspace";

type AppointmentDetailDrawerProps = {
  appointment: Appointment;
  appointmentClient?: ClientRecord;
  onCancelAppointment: (appointment: Appointment) => void;
  onClose: () => void;
  onEditAppointment: (appointment: Appointment) => void;
  onSaveAppointment: (
    appointment: Appointment,
    action?: AdminAuditAction,
    originalAppointment?: Appointment,
  ) => Promise<CalendarAppointmentSaveResult>;
  role: AdminRoleId;
};

type RevealedContact = {
  appointmentId: string;
  email?: string;
  phone?: string;
  preferredContact?: string;
};

function maskPhone(value: string) {
  if (!value || value.includes("*")) return value;
  const digits = value.replace(/\D/g, "");
  return digits.length > 3 ? `••• ${digits.slice(-4)}` : "••••";
}

function maskEmail(value: string) {
  if (!value || value.includes("*")) return value;
  const [localPart, domain] = value.split("@");
  if (!domain) return "••••";
  return `${localPart.slice(0, 1) || "•"}•••@${domain}`;
}

export function AppointmentDetailDrawer({
  appointment,
  appointmentClient,
  onCancelAppointment,
  onClose,
  onEditAppointment,
  onSaveAppointment,
  role,
}: AppointmentDetailDrawerProps) {
  const initialPostVisitComment = appointment.postVisitComment ?? "";
  const [postVisitComment, setPostVisitComment] = useState(initialPostVisitComment);
  const [savedPostVisitComment, setSavedPostVisitComment] = useState(initialPostVisitComment);
  const [postVisitSaveState, setPostVisitSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [revealedContact, setRevealedContact] = useState<RevealedContact>();
  const [contactRevealAppointmentId, setContactRevealAppointmentId] = useState("");
  const [contactRevealState, setContactRevealState] = useState<"idle" | "loading" | "error">("idle");
  const [contactRevealError, setContactRevealError] = useState("");
  const canCommentAfterVisit = isPostVisitCommentAvailable(appointment);
  const needsCompletionWarning =
    canCommentAfterVisit && appointment.status !== "Завершена" && appointment.status !== "Не пришёл";
  const hasUnsavedChanges = postVisitComment !== savedPostVisitComment;
  const requiresContactReveal = role === "specialist" || Boolean(appointmentClient?.contactRestricted);
  const currentRevealedContact = revealedContact?.appointmentId === appointment.id
    ? revealedContact
    : undefined;
  const rawPhone = currentRevealedContact?.phone ?? appointmentClient?.phone ?? appointment.publicPhone ?? "";
  const rawEmail = currentRevealedContact?.email ?? appointmentClient?.email ?? appointment.publicEmail ?? "";
  const displayedPhone = requiresContactReveal && !currentRevealedContact ? maskPhone(rawPhone) : rawPhone;
  const displayedEmail = requiresContactReveal && !currentRevealedContact ? maskEmail(rawEmail) : rawEmail;
  const publicContactLabel = appointment.publicContactPreference
    ? ({ email: "Email", phone: "Телефон", telegram: "Telegram", viber: "Viber" } as const)[appointment.publicContactPreference]
    : undefined;

  async function revealContact() {
    if (!appointment.id) {
      setContactRevealState("error");
      setContactRevealError("Контакты доступны только для сохраненной записи.");
      return;
    }

    setContactRevealState("loading");
    setContactRevealAppointmentId(appointment.id);
    setRevealedContact(undefined);
    setContactRevealError("");

    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/client-contact", {
        body: JSON.stringify({
          appointmentId: appointment.id,
          purpose: "Связаться с клиентом по текущей записи",
        }),
        headers: {
          "Content-Type": "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        contact?: RevealedContact;
        error?: string;
      };

      if (!response.ok || !payload.contact) {
        throw new Error(payload.error || "Не удалось открыть контакты клиента.");
      }

      setRevealedContact({ ...payload.contact, appointmentId: appointment.id });
      setContactRevealState("idle");
    } catch (error) {
      setContactRevealState("error");
      setContactRevealError(
        error instanceof Error ? error.message : "Не удалось открыть контакты клиента.",
      );
    }
  }

  async function savePostVisitComment() {
    setPostVisitSaveState("saving");
    const comment = postVisitComment.trim();
    const result = await onSaveAppointment(
      {
        ...appointment,
        postVisitComment: comment,
        postVisitCommentedAt: comment ? new Date().toISOString() : undefined,
      },
      "appointment.post_visit_comment",
    );

    if (!result.ok) {
      setPostVisitSaveState("error");
      return;
    }

    setPostVisitComment(comment);
    setSavedPostVisitComment(comment);
    setPostVisitSaveState("saved");
  }

  return (
    <AdminDrawer
      ariaLabel="Детали выбранной записи"
      className="admin-detail-panel admin-appointment-drawer"
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <AdminDrawerHeader
        kicker="Детали записи"
        onClose={onClose}
        title={appointment.client}
        titleId="admin-appointment-drawer-title"
      />
      <AdminDrawerBody>
        <AdminDrawerSection title="Запись">
          <div className="admin-detail-actions">
            {appointmentClient && role !== "specialist" ? (
              <Link className="admin-outline-action" href={clientProfileHref(appointmentClient.id, role)}>
                Открыть клиента
              </Link>
            ) : null}
            <button className="admin-text-action" onClick={() => onEditAppointment(appointment)} type="button">
              Редактировать
            </button>
            {appointment.status === "Отменена" ? null : (
              <button className="admin-danger-button" onClick={() => onCancelAppointment(appointment)} type="button">
                Отменить
              </button>
            )}
          </div>
          <dl className="admin-detail-list">
            <div>
              <dt>Дата</dt>
              <dd>{formatCalendarDay(appointment.date)}</dd>
            </div>
            <div>
              <dt>Услуга</dt>
              <dd>{appointment.service}</dd>
            </div>
            {appointment.specialistName ? (
              <div>
                <dt>Специалист</dt>
                <dd>{appointment.specialistName}</dd>
              </div>
            ) : null}
            <div>
              <dt>Статус</dt>
              <dd>
                <span className={statusClass(appointment.status)}>{appointment.status}</span>
              </dd>
            </div>
            <div>
              <dt>Источник</dt>
              <dd>{appointment.origin === "public" ? "Онлайн-запись" : "Добавлена вручную"}</dd>
            </div>
            {appointment.publicReference ? (
              <div>
                <dt>Номер подтверждения</dt>
                <dd className="admin-tabular">{appointment.publicReference}</dd>
              </div>
            ) : null}
            {displayedPhone ? (
              <div>
                <dt>Телефон клиента</dt>
                <dd className="admin-tabular">{displayedPhone}</dd>
              </div>
            ) : null}
            {displayedEmail ? (
              <div>
                <dt>Email клиента</dt>
                <dd>{displayedEmail}</dd>
              </div>
            ) : null}
            {publicContactLabel ? (
              <div>
                <dt>Предпочтительный способ связи</dt>
                <dd>{publicContactLabel}</dd>
              </div>
            ) : null}
            <div>
              <dt>Время</dt>
              <dd>
                {appointment.time} · {appointment.durationMinutes ?? 60} мин
              </dd>
            </div>
            <div>
              <dt>Комментарий</dt>
              <dd>{appointment.note || "Комментарий к записи пока пуст."}</dd>
            </div>
            {appointment.publicNote ? (
              <div>
                <dt>Данные онлайн-записи</dt>
                <dd>{appointment.publicNote}</dd>
              </div>
            ) : null}
          </dl>
          {requiresContactReveal && !currentRevealedContact ? (
            <div className="admin-detail-actions">
              <button
                className="admin-outline-action"
                disabled={
                  (contactRevealState === "loading" && contactRevealAppointmentId === appointment.id) ||
                  !appointment.id
                }
                onClick={() => void revealContact()}
                type="button"
              >
                {contactRevealState === "loading" && contactRevealAppointmentId === appointment.id
                  ? "Открываем..."
                  : "Показать контакты"}
              </button>
              <small>Просмотр контактов фиксируется в журнале безопасности.</small>
            </div>
          ) : null}
          {currentRevealedContact ? <small role="status">Контакты открыты и просмотр зарегистрирован.</small> : null}
          {contactRevealState === "error" && contactRevealAppointmentId === appointment.id ? (
            <p className="admin-form-alert" role="alert">
              {contactRevealError}
            </p>
          ) : null}
        </AdminDrawerSection>
        <AdminDrawerSection title="После визита">
          {canCommentAfterVisit ? (
            <form
              className="admin-client-note-form"
              onSubmit={(event) => {
                event.preventDefault();
                void savePostVisitComment();
              }}
            >
              {needsCompletionWarning ? (
                <p className="admin-form-alert" role="status">
                  Время визита уже прошло, но запись еще не отмечена как завершенная.
                </p>
              ) : null}
              <label htmlFor="appointment-post-visit-comment">Комментарий после визита</label>
              <textarea
                id="appointment-post-visit-comment"
                name="postVisitComment"
                onChange={(event) => {
                  setPostVisitComment(event.target.value);
                  setPostVisitSaveState("idle");
                }}
                rows={4}
                value={postVisitComment}
              />
              <button className="admin-text-action" disabled={!hasUnsavedChanges || postVisitSaveState === "saving"} type="submit">
                {postVisitSaveState === "saving" ? "Сохранение..." : "Сохранить комментарий"}
              </button>
              {postVisitSaveState === "saved" ? <small role="status">Комментарий сохранен.</small> : null}
              {postVisitSaveState === "error" ? <p className="admin-form-alert" role="alert">Комментарий не сохранен.</p> : null}
            </form>
          ) : (
            <p className="admin-muted-text">Комментарий станет доступен после завершения или наступления времени визита.</p>
          )}
          {appointment.postVisitCommentedAt ? (
            <small>Обновлено {new Date(appointment.postVisitCommentedAt).toLocaleString("ru-RU")}</small>
          ) : null}
        </AdminDrawerSection>
        {appointmentClient && role !== "specialist" ? (
          <AdminDrawerSection title="Связанные действия">
            <section className="admin-linked-client-actions" aria-label="Связанные действия клиента">
              <div className="admin-client-section-head">
                <h3>Клиентская работа</h3>
                <span className={statusClass(appointmentClient.status)}>{appointmentClient.status}</span>
              </div>
              <p>Быстрые переходы к клиентской работе по этой записи.</p>
              <div className="admin-client-next-actions">
                <Link className="admin-client-inline-link" href={clientProfileHref(appointmentClient.id, role)}>
                  Карточка клиента
                </Link>
                <Link className="admin-client-inline-link" href={calendarClientHref(appointmentClient.id, role)}>
                  Все записи клиента
                </Link>
                <Link className="admin-client-inline-link" href={certificateClientHref(appointmentClient.id, role)}>
                  Все сертификаты клиента
                </Link>
                <Link className="admin-client-inline-link" href={calendarCreateHref(appointmentClient.id, role)}>
                  Записать снова
                </Link>
              </div>
            </section>
          </AdminDrawerSection>
        ) : null}
      </AdminDrawerBody>
    </AdminDrawer>
  );
}
