"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AdminRoleId } from "@/admin/config";
import type { Appointment, ClientRecord } from "@/admin/domain";
import { formatCalendarDay } from "@/components/admin/calendar";
import { matchesSearch } from "@/components/admin/lib/filters";
import {
  appointmentKey,
  calendarAppointmentHref,
  clientProfileHref,
} from "@/components/admin/lib/links";

import {
  ClientVisitCommentEditor,
  type ClientVisitCommentSaveResult,
} from "./ClientVisitCommentEditor";
import { needsPostVisitComment } from "./visit-comments";

type PostVisitCommentQueueProps = {
  appointments: Appointment[];
  clients: ClientRecord[];
  hasLoadError?: boolean;
  onSaveComment: (
    appointment: Appointment,
    originalAppointment: Appointment,
  ) => Promise<ClientVisitCommentSaveResult>;
  query: string;
  role: AdminRoleId;
};

function compareAppointmentStart(left: Appointment, right: Appointment) {
  return (
    `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`) ||
    appointmentKey(left).localeCompare(appointmentKey(right))
  );
}

function findAppointmentClient(clients: ClientRecord[], appointment: Appointment) {
  if (appointment.clientId) {
    return clients.find((client) => client.id === appointment.clientId);
  }

  return clients.find((client) => client.name === appointment.client);
}

const UNSAVED_COMMENT_MESSAGE = "Есть несохранённый комментарий. Закрыть без сохранения?";

export function getPendingPostVisitComments(
  appointments: Appointment[],
  now = new Date(),
) {
  return appointments
    .filter((appointment) => needsPostVisitComment(appointment, now))
    .sort(compareAppointmentStart);
}

function pendingCommentCountLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  const visitLabel = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? "визитов"
    : lastDigit === 1
      ? "визит"
      : lastDigit >= 2 && lastDigit <= 4
        ? "визита"
        : "визитов";

  return `${count} ${visitLabel} без комментария`;
}

export function PostVisitCommentQueue({
  appointments,
  clients,
  hasLoadError = false,
  onSaveComment,
  query,
  role,
}: PostVisitCommentQueueProps) {
  const [clock, setClock] = useState(() => new Date());
  const [editingAppointmentKey, setEditingAppointmentKey] = useState("");
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [queueStatus, setQueueStatus] = useState("");
  const actionButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingAppointments = useMemo(
    () => getPendingPostVisitComments(appointments, clock),
    [appointments, clock],
  );
  const editingAppointment = editingAppointmentKey
    ? appointments.find(
        (appointment) => appointmentKey(appointment) === editingAppointmentKey,
      )
    : undefined;
  const queueAppointments = editingAppointment &&
    !pendingAppointments.some(
      (appointment) => appointmentKey(appointment) === editingAppointmentKey,
    )
    ? [...pendingAppointments, editingAppointment].sort(compareAppointmentStart)
    : pendingAppointments;
  const visibleAppointments = queueAppointments.filter(
    (appointment) =>
      appointmentKey(appointment) === editingAppointmentKey ||
      matchesSearch(
        [
          appointment.client,
          appointment.date,
          appointment.time,
          appointment.service,
          appointment.specialistName,
        ],
        query,
      ),
  );

  useEffect(() => {
    const clockInterval = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    if (!isEditorDirty) return;

    function handleDocumentClick(event: globalThis.MouseEvent) {
      const target = event.target;
      const link = target instanceof Element ? target.closest("a[href]") : null;

      if (link && !window.confirm(UNSAVED_COMMENT_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isEditorDirty]);

  function confirmDraftDiscard() {
    return !isEditorDirty || window.confirm(UNSAVED_COMMENT_MESSAGE);
  }

  function changeEditingAppointment(nextKey: string) {
    if (!confirmDraftDiscard()) return;

    const previousKey = editingAppointmentKey;
    setEditingAppointmentKey(nextKey);
    setIsEditorDirty(false);

    if (!nextKey && previousKey) {
      window.setTimeout(() => {
        actionButtonRefs.current.get(previousKey)?.focus();
      }, 0);
    }
  }

  async function saveComment(
    appointment: Appointment,
    originalAppointment: Appointment,
  ) {
    if (!appointment.postVisitComment?.trim()) {
      return {
        message: "Введите комментарий после визита.",
        ok: false as const,
      };
    }

    const currentIndex = queueAppointments.findIndex(
      (candidate) => appointmentKey(candidate) === appointmentKey(originalAppointment),
    );
    const nextAppointment = queueAppointments[currentIndex + 1];
    const result = await onSaveComment(appointment, originalAppointment);

    if (result.ok) {
      setEditingAppointmentKey("");
      setIsEditorDirty(false);
      window.setTimeout(() => {
        const target = nextAppointment
          ? actionButtonRefs.current.get(appointmentKey(nextAppointment))
          : headingRef.current;
        (target ?? headingRef.current)?.focus();
      }, 0);
      setQueueStatus(
        `Комментарий для ${appointment.client} сохранён. Следующий незаполненный визит поднят наверх.`,
      );
    }

    return result;
  }

  return (
    <section
      className="admin-panel admin-panel-large admin-post-visit-queue"
      aria-labelledby="post-visit-comments-heading"
    >
      <div className="admin-panel-head admin-post-visit-queue-head">
        <div>
          <span className="admin-kicker">Рабочая очередь</span>
          <h2 id="post-visit-comments-heading" ref={headingRef} tabIndex={-1}>
            Комментарии после визита
          </h2>
          <p>Прошедшие и завершённые визиты без комментария. Сначала показаны самые старые.</p>
        </div>
        <span className="admin-post-visit-count">
          {pendingCommentCountLabel(pendingAppointments.length)}
        </span>
      </div>

      <p className="admin-visually-hidden" aria-live="polite">
        {queueStatus}
      </p>

      {hasLoadError ? (
        <p className="admin-form-alert" role="alert">
          Не удалось загрузить актуальную очередь. Обновите страницу и попробуйте снова.
        </p>
      ) : visibleAppointments.length > 0 ? (
        <ol className="admin-post-visit-list">
          {visibleAppointments.map((appointment) => {
            const key = appointmentKey(appointment);
            const client = findAppointmentClient(clients, appointment);
            const clientIdentity = client?.id ?? appointment.client;
            const isEditing = editingAppointmentKey === key;
            const globalIndex = queueAppointments.findIndex(
              (candidate) => appointmentKey(candidate) === key,
            );
            const editorId = `post-visit-comment-editor-${encodeURIComponent(key)}`;
            const visitLabel = `${appointment.client}, ${formatCalendarDay(appointment.date)} ${appointment.time}`;

            return (
              <li className={globalIndex === 0 ? "is-next" : undefined} key={key}>
                <div className="admin-post-visit-order" aria-hidden="true">
                  {globalIndex + 1}
                </div>
                <div className="admin-post-visit-summary">
                  <div className="admin-post-visit-primary">
                    <Link
                      className="admin-row-action admin-row-link"
                      href={clientProfileHref(clientIdentity, role)}
                    >
                      {appointment.client}
                    </Link>
                    {globalIndex === 0 ? <span className="admin-post-visit-next">Следующий</span> : null}
                  </div>
                  <span>
                    {formatCalendarDay(appointment.date)}, {appointment.time} · {appointment.service}
                  </span>
                  {appointment.specialistName ? (
                    <small>Специалист: {appointment.specialistName}</small>
                  ) : null}
                </div>
                <div className="admin-post-visit-actions">
                  <Link
                    className="admin-outline-action"
                    href={calendarAppointmentHref(appointment, role, clientIdentity)}
                    aria-label={`Открыть запись: ${visitLabel}`}
                  >
                    Открыть запись
                  </Link>
                  <button
                    aria-controls={editorId}
                    aria-expanded={isEditing}
                    aria-label={`${isEditing ? "Скрыть поле" : "Заполнить комментарий"}: ${visitLabel}`}
                    className="admin-text-action"
                    onClick={() => {
                      setQueueStatus("");
                      changeEditingAppointment(isEditing ? "" : key);
                    }}
                    ref={(node) => {
                      if (node) actionButtonRefs.current.set(key, node);
                      else actionButtonRefs.current.delete(key);
                    }}
                    type="button"
                  >
                    {isEditing ? "Скрыть поле" : "Заполнить комментарий"}
                  </button>
                </div>
                {isEditing ? (
                  <div className="admin-post-visit-editor" id={editorId}>
                    <ClientVisitCommentEditor
                      appointment={appointment}
                      onCancel={() => changeEditingAppointment("")}
                      onDirtyChange={setIsEditorDirty}
                      onSave={(updatedAppointment) =>
                        saveComment(updatedAppointment, appointment)
                      }
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : pendingAppointments.length === 0 ? (
        <p className="admin-post-visit-empty" role="status">
          Все комментарии после прошедших визитов заполнены.
        </p>
      ) : (
        <p className="admin-empty-state">По этому запросу незаполненных комментариев нет.</p>
      )}
    </section>
  );
}
