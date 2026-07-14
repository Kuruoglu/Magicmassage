"use client";

import { type FormEvent, useMemo, useState } from "react";

import {
  serviceLocales,
  type ServiceLocale,
  type ServiceRecord,
  type ServiceStatus,
  type ServiceTranslationRecord,
} from "@/admin/domain";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerHeader,
  AdminDrawerSection,
  useAdminDrawerClose,
} from "@/components/admin/drawer";

type ServiceEditorProps = {
  initialService?: ServiceRecord;
  onClose: () => void;
  onSave: (service: ServiceRecord, originalSlug?: string) => void;
  suggestedOrder: number;
};

type ServiceEditorState = {
  category: string;
  coverImage: string;
  duration: string;
  order: string;
  slug: string;
  status: ServiceStatus;
  translations: Record<ServiceLocale, ServiceTranslationRecord>;
};

const localeLabels: Record<ServiceLocale, string> = {
  bg: "Български",
  ru: "Русский",
  ua: "Українська",
  en: "English",
};

const serviceStatusOptions: ServiceStatus[] = ["Опубликована", "Черновик", "Скрыта"];

function emptyTranslation(locale: ServiceLocale): ServiceTranslationRecord {
  return {
    body: "",
    canonicalUrl: "",
    locale,
    ogDescription: "",
    ogImageMediaId: "",
    ogTitle: "",
    robotsDirectives: "index,follow",
    seoDescription: "",
    seoTitle: "",
    shortDescription: "",
    status: "draft",
    title: "",
  };
}

function buildState(service: ServiceRecord | undefined, suggestedOrder: number): ServiceEditorState {
  const translations = Object.fromEntries(
    serviceLocales.map((locale) => {
      const translation = service?.translations?.[locale];

      if (translation) return [locale, translation];

      const fallback = emptyTranslation(locale);
      if (locale === "bg" && service) {
        fallback.title = service.name;
        fallback.shortDescription = service.summary;
        fallback.seoTitle = service.seoTitle;
      }

      return [locale, fallback];
    }),
  ) as Record<ServiceLocale, ServiceTranslationRecord>;

  return {
    category: service?.category ?? "Массаж",
    coverImage: service?.coverImage ?? "",
    duration: service?.duration ?? "60 мин",
    order: String(service?.order ?? suggestedOrder),
    slug: service?.slug ?? "",
    status: service?.status ?? "Черновик",
    translations,
  };
}

function CancelButton({ onClose }: { onClose: () => void }) {
  const requestClose = useAdminDrawerClose() ?? onClose;
  return (
    <button className="admin-secondary-button" onClick={requestClose} type="button">
      Отмена
    </button>
  );
}

export function ServiceEditor({ initialService, onClose, onSave, suggestedOrder }: ServiceEditorProps) {
  const initialState = useMemo(() => buildState(initialService, suggestedOrder), [initialService, suggestedOrder]);
  const [form, setForm] = useState(initialState);
  const [activeLocale, setActiveLocale] = useState<ServiceLocale>("bg");
  const [error, setError] = useState("");
  const translation = form.translations[activeLocale];
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialState);

  function updateBase<Field extends Exclude<keyof ServiceEditorState, "translations">>(
    field: Field,
    value: ServiceEditorState[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function updateTranslation<Field extends keyof ServiceTranslationRecord>(
    field: Field,
    value: ServiceTranslationRecord[Field],
  ) {
    setForm((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [activeLocale]: { ...current.translations[activeLocale], [field]: value },
      },
    }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slug = form.slug.trim();
    const completedTranslations = serviceLocales.filter((locale) => form.translations[locale].title.trim());

    if (!slug || completedTranslations.length === 0) {
      setError("Укажите slug и название хотя бы для одной локали.");
      return;
    }

    if (form.status === "Опубликована") {
      const incompleteLocale = serviceLocales.find((locale) => {
        const item = form.translations[locale];
        return !item.title.trim() || !item.shortDescription.trim() || !item.body.trim() || !item.seoDescription.trim();
      });

      if (incompleteLocale || !form.coverImage.trim()) {
        setActiveLocale(incompleteLocale ?? "bg");
        setError("Для публикации заполните обложку, название, краткое и полное описание, а также SEO description для всех локалей.");
        return;
      }
    }

    const translations = Object.fromEntries(
      completedTranslations.map((locale) => {
        const item = form.translations[locale];
        return [
          locale,
          {
            ...item,
            body: item.body.trim(),
            canonicalUrl: item.canonicalUrl.trim(),
            ogDescription: item.ogDescription.trim() || item.seoDescription.trim(),
            ogImageMediaId: item.ogImageMediaId.trim(),
            ogTitle: item.ogTitle.trim() || item.title.trim(),
            seoDescription: item.seoDescription.trim(),
            seoTitle: item.seoTitle.trim() || item.title.trim(),
            shortDescription: item.shortDescription.trim(),
            status: form.status === "Опубликована" ? "published" : item.status,
            title: item.title.trim(),
          },
        ];
      }),
    ) as ServiceRecord["translations"];
    const primary = translations?.bg ?? translations?.ru ?? translations?.ua ?? translations?.en;

    if (!primary) return;

    onSave(
      {
        category: form.category.trim() || "Массаж",
        coverImage: form.coverImage.trim(),
        duration: form.duration.trim() || "60 мин",
        locales: completedTranslations,
        name: primary.title,
        order: Number.parseInt(form.order, 10) || suggestedOrder,
        seoTitle: primary.seoTitle,
        slug,
        status: form.status,
        summary: primary.shortDescription,
        translations,
      },
      initialService?.slug,
    );
  }

  return (
    <AdminDrawer
      ariaLabelledBy="service-editor-title"
      className="admin-drawer-wide"
      hasUnsavedChanges={isDirty}
      onClose={onClose}
    >
      <AdminDrawerHeader
        kicker="Виды массажа"
        onClose={onClose}
        title={initialService ? `Редактировать: ${initialService.name}` : "Новая услуга"}
        titleId="service-editor-title"
      >
        <p>Основные параметры и локализованный контент публичной страницы.</p>
      </AdminDrawerHeader>
      <form noValidate onSubmit={handleSubmit}>
        <AdminDrawerBody>
          <AdminDrawerSection title="Публикация">
            <div className="admin-content-form-grid">
              <label>
                Slug
                <input
                  aria-describedby={initialService ? "service-slug-help" : undefined}
                  onChange={(event) => updateBase("slug", event.target.value)}
                  readOnly={Boolean(initialService)}
                  required
                  type="text"
                  value={form.slug}
                />
                {initialService ? <small id="service-slug-help">Slug фиксируется после создания услуги.</small> : null}
              </label>
              <label>
                Статус
                <select onChange={(event) => updateBase("status", event.target.value as ServiceStatus)} value={form.status}>
                  {serviceStatusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                Категория
                <input onChange={(event) => updateBase("category", event.target.value)} type="text" value={form.category} />
              </label>
              <label>
                Порядок
                <input min="1" onChange={(event) => updateBase("order", event.target.value)} type="number" value={form.order} />
              </label>
              <label>
                Длительность
                <input onChange={(event) => updateBase("duration", event.target.value)} type="text" value={form.duration} />
              </label>
              <label className="admin-form-wide">
                URL обложки
                <input onChange={(event) => updateBase("coverImage", event.target.value)} type="text" value={form.coverImage} />
              </label>
            </div>
          </AdminDrawerSection>

          <AdminDrawerSection title="Локализованный контент">
            <div aria-label="Локаль услуги" className="admin-filter-row" role="tablist">
              {serviceLocales.map((locale) => (
                <button
                  aria-selected={activeLocale === locale}
                  key={locale}
                  onClick={() => setActiveLocale(locale)}
                  role="tab"
                  type="button"
                >
                  {locale.toUpperCase()} · {localeLabels[locale]}
                </button>
              ))}
            </div>
            <div className="admin-content-form-grid" role="tabpanel">
              <label className="admin-form-wide">
                Название
                <input onChange={(event) => updateTranslation("title", event.target.value)} type="text" value={translation.title} />
              </label>
              <label className="admin-form-wide">
                Краткое описание
                <textarea onChange={(event) => updateTranslation("shortDescription", event.target.value)} rows={3} value={translation.shortDescription} />
              </label>
              <label className="admin-form-wide">
                Полный текст
                <textarea onChange={(event) => updateTranslation("body", event.target.value)} rows={8} value={translation.body} />
              </label>
              <label>
                SEO title
                <input onChange={(event) => updateTranslation("seoTitle", event.target.value)} type="text" value={translation.seoTitle} />
              </label>
              <label>
                SEO description ({translation.seoDescription.length}/160)
                <textarea maxLength={200} onChange={(event) => updateTranslation("seoDescription", event.target.value)} rows={3} value={translation.seoDescription} />
              </label>
              <label>
                Open Graph title
                <input onChange={(event) => updateTranslation("ogTitle", event.target.value)} type="text" value={translation.ogTitle} />
              </label>
              <label>
                Open Graph description
                <textarea onChange={(event) => updateTranslation("ogDescription", event.target.value)} rows={3} value={translation.ogDescription} />
              </label>
              <label>
                Canonical URL
                <input onChange={(event) => updateTranslation("canonicalUrl", event.target.value)} type="url" value={translation.canonicalUrl} />
              </label>
              <label>
                Robots
                <select onChange={(event) => updateTranslation("robotsDirectives", event.target.value)} value={translation.robotsDirectives}>
                  <option value="index,follow">index,follow</option>
                  <option value="noindex,follow">noindex,follow</option>
                  <option value="noindex,nofollow">noindex,nofollow</option>
                </select>
              </label>
              <label className="admin-form-wide">
                ID Open Graph изображения
                <input onChange={(event) => updateTranslation("ogImageMediaId", event.target.value)} type="text" value={translation.ogImageMediaId} />
              </label>
            </div>
          </AdminDrawerSection>
          {error ? <p className="admin-form-alert" role="alert">{error}</p> : null}
        </AdminDrawerBody>
        <AdminDrawerFooter>
          <button type="submit">Сохранить услугу</button>
          <CancelButton onClose={onClose} />
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
  );
}
