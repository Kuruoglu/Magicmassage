"use client";

import { type FormEvent, useEffect, useState } from "react";

import type { Appointment } from "@/admin/domain";

type ClientVisitCommentEditorProps = {
  appointment: Appointment;
  onCancel?: () => void;
  onDirtyChange?: (hasUnsavedChanges: boolean) => void;
  onSave: (appointment: Appointment) => Promise<ClientVisitCommentSaveResult>;
};

export type ClientVisitCommentSaveResult =
  | { ok: true }
  | {
      message: string;
      ok: false;
    };

export function ClientVisitCommentEditor({
  appointment,
  onCancel,
  onDirtyChange,
  onSave,
}: ClientVisitCommentEditorProps) {
  const initialComment = appointment.postVisitComment ?? "";
  const [comment, setComment] = useState(initialComment);
  const [savedComment, setSavedComment] = useState(initialComment);
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasUnsavedChanges = comment !== savedComment;

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);

    return () => onDirtyChange?.(false);
  }, [hasUnsavedChanges, onDirtyChange]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextComment = comment.trim();
    setSaveError("");
    setSaveStatus("");
    setIsSaving(true);

    try {
      const result = await onSave({
        ...appointment,
        postVisitComment: nextComment,
        postVisitCommentedAt: nextComment ? new Date().toISOString() : undefined,
      });

      if (!result.ok) {
        setSaveError(result.message);
        return;
      }

      setComment(nextComment);
      setSavedComment(nextComment);
      setSaveStatus("Комментарий сохранен.");
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Комментарий не сохранен.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form aria-busy={isSaving} className="admin-client-note-form" onSubmit={handleSubmit}>
      <label htmlFor={`visit-comment-${appointment.id ?? `${appointment.date}-${appointment.time}`}`}>
        Комментарий после визита
      </label>
      <textarea
        autoFocus
        disabled={isSaving}
        id={`visit-comment-${appointment.id ?? `${appointment.date}-${appointment.time}`}`}
        onChange={(event) => {
          setComment(event.target.value);
          setSaveError("");
          setSaveStatus("");
        }}
        rows={3}
        value={comment}
      />
      <div className="admin-client-note-actions">
        <button className="admin-text-action" disabled={!hasUnsavedChanges || isSaving} type="submit">
          {isSaving ? "Сохранение..." : "Сохранить комментарий"}
        </button>
        {onCancel ? <button className="admin-outline-action" disabled={isSaving} onClick={onCancel} type="button">Отмена</button> : null}
      </div>
      {saveStatus ? <p className="admin-client-save-notice" role="status">{saveStatus}</p> : null}
      {saveError ? <p className="admin-form-alert" role="alert">{saveError}</p> : null}
    </form>
  );
}
