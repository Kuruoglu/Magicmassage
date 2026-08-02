"use client";

import { AdminLink as Link } from "@/components/admin/AdminLink";
import { type FormEvent, useRef, useState } from "react";

import type { AdminRoleId } from "@/admin/config";
import {
  buildClientIdFromPhone,
  matchesClientIdentity,
  normalizeClientPhone,
  normalizeSearch,
  type ClientRecord,
} from "@/admin/domain";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerHeader,
  useAdminDrawerClose,
} from "@/components/admin/drawer";
import { parseClientTags } from "@/components/admin/lib/filters";
import { clientProfileHref } from "@/components/admin/lib/links";

const languageOptions = [
  { label: "RU", value: "ru" },
  { label: "BG", value: "bg" },
  { label: "UA", value: "ua" },
  { label: "EN", value: "en" },
] as const;
const contactOptions = ["Телефон", "Telegram", "Viber", "Email"] as const;
const statusOptions = ["Новый клиент", "Активный клиент", "Пауза"] as const;

type ClientFormState = {
  email: string;
  language: string;
  name: string;
  next: string;
  note: string;
  phone: string;
  preferredContact: string;
  status: string;
  tags: string;
  telegram: string;
  totalSpend: string;
  visits: string;
};

export type ClientFormProps = {
  clients: ClientRecord[];
  initialClient?: ClientRecord;
  onClose: () => void;
  onSave: (client: ClientRecord, originalClientIdentity?: string) => void;
  role: AdminRoleId;
};

function buildFormState(client?: ClientRecord): ClientFormState {
  return {
    email: client?.email ?? "",
    language: client?.language ?? "ru",
    name: client?.name ?? "",
    next: client?.next ?? "",
    note: client?.note ?? "",
    phone: client?.phone ?? "",
    preferredContact: client?.preferredContact ?? "Телефон",
    status: client?.status ?? "Новый клиент",
    tags: client?.tags.join(", ") ?? "",
    telegram: client?.telegram ?? "",
    totalSpend: client?.totalSpend ?? "0 €",
    visits: String(client?.visits ?? 0),
  };
}

function findPhoneDuplicate(clients: ClientRecord[], phone: string, originalClientIdentity?: string) {
  const candidatePhone = normalizeClientPhone(phone);
  if (!candidatePhone) return undefined;

  return clients.find(
    (client) =>
      !matchesClientIdentity(client, originalClientIdentity) &&
      normalizeClientPhone(client.phone) === candidatePhone,
  );
}

function findNameMatch(clients: ClientRecord[], name: string, originalClientIdentity?: string) {
  const candidateName = normalizeSearch(name);
  if (!candidateName) return undefined;

  return clients.find(
    (client) =>
      !matchesClientIdentity(client, originalClientIdentity) && normalizeSearch(client.name) === candidateName,
  );
}

function CancelButton({ onClose }: { onClose: () => void }) {
  const requestClose = useAdminDrawerClose() ?? onClose;
  return (
    <button className="admin-secondary-button" onClick={requestClose} type="button">
      Отмена
    </button>
  );
}

function GuardedClientLink({ clientId, onClose, role }: { clientId: string; onClose: () => void; role: AdminRoleId }) {
  const requestClose = useAdminDrawerClose();
  return (
    <Link
      href={clientProfileHref(clientId, role)}
      onClick={(event) => {
        if (requestClose) {
          if (!requestClose()) event.preventDefault();
          return;
        }
        onClose();
      }}
    >
      Открыть карточку существующего клиента
    </Link>
  );
}

export function ClientForm({ clients, initialClient, onClose, onSave, role }: ClientFormProps) {
  const initialConsentClient = initialClient;
  const initialCareEmailConsent = Boolean(
    initialConsentClient?.careEmailConsentAt && !initialConsentClient.careEmailWithdrawnAt,
  );
  const [form, setForm] = useState<ClientFormState>(() => buildFormState(initialClient));
  const [careEmailConsentDecision, setCareEmailConsentDecision] = useState<{
    consent: boolean;
    email: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [duplicateClient, setDuplicateClient] = useState<ClientRecord>();
  const [isNoteOpen, setIsNoteOpen] = useState(() => Boolean(initialClient?.note));
  const nameInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const originalClientIdentity = initialClient?.id ?? initialClient?.phone ?? initialClient?.name;
  const matchingNameClient = findNameMatch(clients, form.name, originalClientIdentity);
  const hasNameError = Boolean(error && !form.name.trim());
  const hasPhoneError = Boolean(error && !form.phone.trim());
  const currentEmail = form.email.trim().toLowerCase();
  const initialEmail = initialClient?.email.trim().toLowerCase() ?? "";
  const applicableConsentDecision =
    careEmailConsentDecision?.email === currentEmail ? careEmailConsentDecision : null;
  const initialConsentAppliesToCurrentEmail =
    initialCareEmailConsent && currentEmail === initialEmail;
  const careEmailConsent =
    applicableConsentDecision?.consent ?? initialConsentAppliesToCurrentEmail;
  const consentChanged =
    (initialCareEmailConsent && !initialConsentAppliesToCurrentEmail) ||
    (applicableConsentDecision !== null &&
      applicableConsentDecision.consent !== initialConsentAppliesToCurrentEmail);
  const hasUnsavedChanges =
    JSON.stringify(form) !== JSON.stringify(buildFormState(initialClient)) ||
    consentChanged;
  const canManageCareEmailConsent = role === "owner" || role === "administrator";

  function updateForm<Field extends keyof ClientFormState>(field: Field, value: ClientFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setDuplicateClient(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name || !phone) {
      setError("Укажите имя и телефон клиента.");
      (name ? phoneInputRef : nameInputRef).current?.focus();
      return;
    }

    const matchingClient = findPhoneDuplicate(clients, phone, originalClientIdentity);
    if (matchingClient) {
      setDuplicateClient(matchingClient);
      setError(`Клиент с таким телефоном уже есть: ${matchingClient.name}.`);
      phoneInputRef.current?.focus();
      return;
    }

    const visits = Number.parseInt(form.visits, 10);
    const consentFields = canManageCareEmailConsent && consentChanged
      ? careEmailConsent
        ? {
            careEmailConsentAt: new Date().toISOString(),
            careEmailConsentSource: "admin_recorded" as const,
            careEmailExpectedConsentAt: initialConsentClient?.careEmailConsentAt ?? null,
            careEmailExpectedConsentSource: initialConsentClient?.careEmailConsentSource ?? null,
            careEmailExpectedWithdrawnAt: initialConsentClient?.careEmailWithdrawnAt ?? null,
            careEmailWithdrawnAt: undefined,
          }
        : {
            careEmailConsentAt: initialConsentClient?.careEmailConsentAt,
            careEmailConsentSource: initialConsentClient?.careEmailConsentSource,
            careEmailExpectedConsentAt: initialConsentClient?.careEmailConsentAt ?? null,
            careEmailExpectedConsentSource: initialConsentClient?.careEmailConsentSource ?? null,
            careEmailExpectedWithdrawnAt: initialConsentClient?.careEmailWithdrawnAt ?? null,
            careEmailWithdrawnAt: new Date().toISOString(),
          }
      : {};
    onSave(
      {
        ...consentFields,
        email: form.email.trim(),
        history: initialClient?.history.map((visit) => ({ ...visit })) ?? [],
        id: initialClient?.id ?? buildClientIdFromPhone(phone),
        language: form.language,
        name,
        next: form.next.trim() || "Не назначен",
        note: form.note.trim(),
        phone,
        preferredContact: form.preferredContact,
        status: form.status,
        tags: parseClientTags(form.tags),
        telegram: form.telegram.trim(),
        totalSpend: form.totalSpend.trim() || "0 €",
        visits: Number.isFinite(visits) ? Math.max(visits, 0) : 0,
      },
      originalClientIdentity,
    );
  }

  return (
    <AdminDrawer
      ariaLabelledBy="client-action-title"
      className="admin-client-form-drawer"
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <form className="admin-drawer-form" noValidate onSubmit={handleSubmit}>
        <AdminDrawerHeader
          kicker="Клиенты"
          onClose={onClose}
          title={initialClient ? "Редактировать клиента" : "Новый клиент"}
          titleId="client-action-title"
        />
        <AdminDrawerBody>
          <div className="admin-client-form-layout">
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
                {duplicateClient ? (
                  <> <GuardedClientLink clientId={duplicateClient.id} onClose={onClose} role={role} /></>
                ) : null}
              </p>
            ) : null}
            {matchingNameClient && !duplicateClient ? (
              <p className="admin-form-warning admin-form-alert-wide" role="status">
                Имя уже есть в базе: {matchingNameClient.name}. Если телефон другой, можно сохранить нового клиента.
              </p>
            ) : null}

            <fieldset className="admin-form-section">
              <legend>Контакты клиента</legend>
              <p className="admin-form-helper" id="client-contact-helper">Имя и телефон нужны для записи и связи с клиентом.</p>
              <div className="admin-client-form-grid">
                <div className="admin-field">
                  <label htmlFor="client-name-input">Имя</label>
                  <input
                    aria-describedby={`client-contact-helper${hasNameError ? " client-name-error" : ""}`}
                    aria-invalid={hasNameError ? "true" : undefined}
                    autoComplete="name"
                    id="client-name-input"
                    onChange={(event) => updateForm("name", event.target.value)}
                    ref={nameInputRef}
                    required
                    type="text"
                    value={form.name}
                  />
                  {hasNameError ? <span className="admin-field-error" id="client-name-error">Укажите имя клиента.</span> : null}
                </div>
                <div className="admin-field">
                  <label htmlFor="client-phone-input">Телефон</label>
                  <input
                    aria-describedby={`client-contact-helper${hasPhoneError ? " client-phone-error" : ""}`}
                    aria-invalid={hasPhoneError ? "true" : undefined}
                    autoComplete="tel"
                    id="client-phone-input"
                    onChange={(event) => updateForm("phone", event.target.value)}
                    ref={phoneInputRef}
                    required
                    type="tel"
                    value={form.phone}
                  />
                  {hasPhoneError ? <span className="admin-field-error" id="client-phone-error">Укажите телефон клиента.</span> : null}
                </div>
                <label>
                  Email
                  <input
                    autoComplete="email"
                    onChange={(event) => updateForm("email", event.target.value)}
                    type="email"
                    value={form.email}
                  />
                </label>
                <label>Telegram<input autoComplete="url" onChange={(event) => updateForm("telegram", event.target.value)} type="url" value={form.telegram} /></label>
                <label>Язык<select onChange={(event) => updateForm("language", event.target.value)} value={form.language}>{languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>Канал связи<select onChange={(event) => updateForm("preferredContact", event.target.value)} value={form.preferredContact}>{contactOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              </div>
            </fieldset>

            {canManageCareEmailConsent ? (
              <fieldset className="admin-form-section">
                <legend>Email после визита</legend>
                <label className="admin-checkbox-field admin-form-wide">
                  <input
                    aria-describedby="client-care-email-consent-helper"
                    checked={careEmailConsent}
                    disabled={!form.email.trim()}
                    onChange={(event) => {
                      setCareEmailConsentDecision({
                        consent: event.target.checked,
                        email: currentEmail,
                      });
                    }}
                    type="checkbox"
                  />
                  <span>Клиент явно согласился получать письмо после визита</span>
                </label>
                <p className="admin-form-helper" id="client-care-email-consent-helper">
                  {form.email.trim()
                    ? "Включайте только после явного согласия клиента. Изменение сохраняется с датой и источником в audit log."
                    : "Сначала добавьте email клиента. Без адреса согласие нельзя зафиксировать."}
                </p>
                {initialConsentClient?.careEmailConsentAt ? (
                  <p className="admin-form-helper">
                    Последнее согласие: {new Date(initialConsentClient.careEmailConsentAt).toLocaleString("ru-RU")}
                    {initialConsentClient.careEmailConsentSource ? ` · источник: ${initialConsentClient.careEmailConsentSource}` : ""}.
                  </p>
                ) : null}
              </fieldset>
            ) : null}

            <fieldset className="admin-form-section">
              <legend>Профиль клиента</legend>
              <p className="admin-form-helper" id="client-status-helper">Статус выбирается вручную и не скрывает клиента из базы.</p>
              <div className="admin-client-form-grid">
                <label>Статус<select aria-describedby="client-status-helper" onChange={(event) => updateForm("status", event.target.value)} value={form.status}>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label>Следующий визит<input onChange={(event) => updateForm("next", event.target.value)} type="text" value={form.next} /></label>
                <label>Визиты<input min="0" onChange={(event) => updateForm("visits", event.target.value)} type="number" value={form.visits} /></label>
                <label>Сумма<input onChange={(event) => updateForm("totalSpend", event.target.value)} type="text" value={form.totalSpend} /></label>
              </div>
            </fieldset>

            <fieldset className="admin-form-section">
              <legend>Заметки и теги</legend>
              <div className="admin-client-form-grid">
                {isNoteOpen ? (
                  <div className="admin-field admin-form-wide">
                    <label htmlFor="client-note-input">Заметка клиента</label>
                    <textarea id="client-note-input" onChange={(event) => updateForm("note", event.target.value)} ref={noteInputRef} rows={4} value={form.note} />
                    {!form.note ? <button className="admin-outline-action admin-note-disclosure" onClick={() => { updateForm("note", ""); setIsNoteOpen(false); }} type="button">Убрать пустую заметку</button> : null}
                  </div>
                ) : (
                  <button className="admin-outline-action admin-form-wide admin-note-disclosure" onClick={() => { setIsNoteOpen(true); window.requestAnimationFrame(() => noteInputRef.current?.focus()); }} type="button">Добавить заметку</button>
                )}
                <label className="admin-form-wide">Теги<input onChange={(event) => updateForm("tags", event.target.value)} type="text" value={form.tags} /></label>
              </div>
            </fieldset>
          </div>
        </AdminDrawerBody>
        <AdminDrawerFooter>
          <button className="admin-primary-button" type="submit">{initialClient ? "Сохранить изменения" : "Сохранить клиента"}</button>
          <CancelButton onClose={onClose} />
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
  );
}
