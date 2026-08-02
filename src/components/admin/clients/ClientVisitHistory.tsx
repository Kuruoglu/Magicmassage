"use client";

import { AdminLink as Link } from "@/components/admin/AdminLink";

import type { AdminRoleId } from "@/admin/config";
import type { Appointment, ClientVisit } from "@/admin/domain";
import { statusClass } from "@/components/admin/lib/formatters";
import { calendarAppointmentHref, appointmentKey } from "@/components/admin/lib/links";
import {
  ClientVisitCommentEditor,
  type ClientVisitCommentSaveResult,
} from "./ClientVisitCommentEditor";
import { isPostVisitCommentAvailable } from "./visit-comments";

export type ClientVisitHistoryItem = {
  appointment?: Appointment;
  visit: ClientVisit;
};

type ClientVisitHistoryProps = {
  clientId: string;
  editingVisitKey: string;
  items: ClientVisitHistoryItem[];
  onCommentDirtyChange?: (hasUnsavedChanges: boolean) => void;
  onEditVisit: (appointmentKey: string) => void;
  onSaveComment: (appointment: Appointment) => Promise<ClientVisitCommentSaveResult>;
  role: AdminRoleId;
};

export function ClientVisitHistory({
  clientId,
  editingVisitKey,
  items,
  onCommentDirtyChange,
  onEditVisit,
  onSaveComment,
  role,
}: ClientVisitHistoryProps) {
  return (
    <ol className="admin-client-history">
      {items.map(({ appointment, visit }) => {
        const key = appointment ? appointmentKey(appointment) : "";
        const canComment = appointment ? isPostVisitCommentAvailable(appointment) : false;

        return (
          <li key={`${visit.date}-${visit.service}`}>
            <div>
              <strong>{visit.service}</strong>
              <span>{visit.date}</span>
              {appointment?.postVisitComment ? <small>{appointment.postVisitComment}</small> : null}
            </div>
            <span className="admin-client-history-actions">
              <span className={statusClass(visit.status)}>{visit.status}</span>
              {appointment ? (
                <Link
                  aria-label={`Открыть запись ${visit.date}`}
                  className="admin-client-inline-link"
                  href={calendarAppointmentHref(appointment, role, clientId)}
                >
                  Открыть запись
                </Link>
              ) : null}
              {appointment && canComment ? (
                <button className="admin-client-inline-button" onClick={() => onEditVisit(key)} type="button">
                  {appointment.postVisitComment ? "Редактировать комментарий" : "Добавить комментарий"}
                </button>
              ) : null}
            </span>
            {appointment && editingVisitKey === key ? (
              <div className="admin-form-wide">
                {appointment.status !== "Завершена" && appointment.status !== "Не пришёл" ? (
                  <p className="admin-form-alert" role="status">
                    Время визита уже прошло, но запись еще не отмечена завершенной.
                  </p>
                ) : null}
                <ClientVisitCommentEditor
                  appointment={appointment}
                  onCancel={() => onEditVisit("")}
                  onDirtyChange={onCommentDirtyChange}
                  onSave={onSaveComment}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
