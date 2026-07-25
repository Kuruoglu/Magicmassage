"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { CalendarAppointmentSaveResult } from "./calendar/CalendarWorkspace";

type AdminRecordDeleteDialogProps = {
  blockedReason?: string;
  confirmLabel: string;
  confirmationText?: string;
  description: string;
  kicker: string;
  onClose: () => void;
  onConfirm: () => Promise<CalendarAppointmentSaveResult>;
  subject: string;
  summaryItems: string[];
  title: string;
};

export function AdminRecordDeleteDialog({
  blockedReason,
  confirmLabel,
  confirmationText,
  description,
  kicker,
  onClose,
  onConfirm,
  subject,
  summaryItems,
  title,
}: AdminRecordDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const safeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = `admin-delete-${kicker.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-")}-title`;
  const hasConfirmed = !confirmationText || confirmation.trim() === confirmationText.trim();
  const canDelete = !blockedReason && hasConfirmed && !isPending;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgroundLayers = Array.from(document.querySelectorAll<HTMLElement>(".admin-drawer-backdrop"));
    const previousLayerState = backgroundLayers.map((layer) => ({
      ariaHidden: layer.getAttribute("aria-hidden"),
      inert: layer.hasAttribute("inert"),
      layer,
    }));

    backgroundLayers.forEach((layer) => {
      layer.setAttribute("aria-hidden", "true");
      layer.setAttribute("inert", "");
    });
    safeButtonRef.current?.focus();

    return () => {
      previousLayerState.forEach(({ ariaHidden, inert, layer }) => {
        if (ariaHidden === null) layer.removeAttribute("aria-hidden");
        else layer.setAttribute("aria-hidden", ariaHidden);

        if (!inert) layer.removeAttribute("inert");
      });

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
        return;
      }

      document.querySelector<HTMLElement>(
        'main button:not([disabled]), main a[href], main input:not([disabled]), main [tabindex]:not([tabindex="-1"])',
      )?.focus();
    };
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !isPending) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (controls.length === 0) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function confirmDeletion() {
    if (!canDelete) return;
    setError("");
    setIsPending(true);
    const result = await onConfirm();
    setIsPending(false);

    if (result.ok) onClose();
    else setError(result.message);
  }

  return (
    <div className="admin-action-backdrop">
      <section
        aria-busy={isPending}
        aria-labelledby={titleId}
        aria-modal="true"
        className="admin-action-dialog admin-delete-dialog"
        onKeyDown={handleDialogKeyDown}
        role="alertdialog"
      >
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">{kicker}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="admin-icon-button" disabled={isPending} onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <p className="admin-confirm-copy">
          <strong>{subject}</strong>. {description}
        </p>
        <div className="admin-confirm-summary" aria-label="Удаляемые данные">
          {summaryItems.map((item) => <span key={item}>{item}</span>)}
        </div>

        {blockedReason ? <p className="admin-form-alert" role="alert">{blockedReason}</p> : null}
        {confirmationText && !blockedReason ? (
          <label className="admin-field admin-delete-confirmation-field">
            <span>Для подтверждения введите: <strong>{confirmationText}</strong></span>
            <input
              autoComplete="off"
              disabled={isPending}
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </label>
        ) : null}
        {error ? <p className="admin-form-alert" role="alert">{error}</p> : null}

        <div className="admin-action-footer admin-delete-dialog-actions">
          <button
            className="admin-secondary-button"
            disabled={isPending}
            onClick={onClose}
            ref={safeButtonRef}
            type="button"
          >
            Не удалять
          </button>
          {!blockedReason ? (
            <button
              className="admin-danger-action"
              disabled={!canDelete}
              onClick={() => void confirmDeletion()}
              type="button"
            >
              {isPending ? "Удаляем…" : confirmLabel}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
