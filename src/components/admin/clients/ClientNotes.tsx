"use client";

import type { FormEvent } from "react";

type ClientNotesProps = {
  draftNote: string;
  isEditing: boolean;
  note: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onEdit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saveNotice?: string;
};

export function ClientNotes({
  draftNote,
  isEditing,
  note,
  onCancel,
  onChange,
  onEdit,
  onSubmit,
  saveNotice,
}: ClientNotesProps) {
  return (
    <>
      <div className="admin-client-section-head">
        <h3>Заметки</h3>
        {isEditing ? null : (
          <button className="admin-outline-action" onClick={onEdit} type="button">
            Редактировать заметку
          </button>
        )}
      </div>
      {isEditing ? (
        <form className="admin-client-note-form" onSubmit={onSubmit}>
          <label htmlFor="admin-client-note-editor">Заметка клиента</label>
          <textarea
            id="admin-client-note-editor"
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            value={draftNote}
          />
          <div className="admin-client-note-actions">
            <button className="admin-text-action" type="submit">Сохранить заметку</button>
            <button className="admin-outline-action" onClick={onCancel} type="button">Отмена</button>
          </div>
        </form>
      ) : (
        <p>{note || "Заметка пока пустая."}</p>
      )}
      {saveNotice ? <p className="admin-client-save-notice" role="status">{saveNotice}</p> : null}
    </>
  );
}
