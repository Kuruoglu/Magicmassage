"use client";

import styles from "./BlogArticleEditor.module.css";
import {
  BLOG_LOCALES,
  BLOG_STATUSES,
  type BlogArticleDraft,
  type BlogArticlePatchHandler,
  type BlogArticleValidationErrors,
} from "./types";

const LOCALE_LABELS: Record<BlogArticleDraft["locale"], string> = {
  bg: "Български",
  en: "English",
  ru: "Русский",
  ua: "Українська",
};

const STATUS_LABELS: Record<BlogArticleDraft["status"], string> = {
  draft: "Черновик",
  published: "Опубликована",
  review: "На проверке",
  scheduled: "Запланирована",
};

export type BlogPublishPanelProps = {
  errors?: BlogArticleValidationErrors;
  idPrefix: string;
  onChange: BlogArticlePatchHandler;
  value: BlogArticleDraft;
};

export function BlogPublishPanel({ errors = {}, idPrefix, onChange, value }: BlogPublishPanelProps) {
  const fieldId = (field: keyof BlogArticleDraft) => `${idPrefix}-${field}`;
  const scheduledAtErrorId = `${fieldId("scheduledAt")}-error`;

  return (
    <fieldset className={styles.fieldGroup}>
      <legend>Публикация</legend>
      <div className={styles.field}>
        <label htmlFor={fieldId("locale")}>Язык</label>
        <select
          id={fieldId("locale")}
          onChange={(event) => onChange({ locale: event.target.value as BlogArticleDraft["locale"] })}
          value={value.locale}
        >
          {BLOG_LOCALES.map((locale) => (
            <option key={locale} value={locale}>
              {LOCALE_LABELS[locale]}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={fieldId("status")}>Статус</label>
        <select
          id={fieldId("status")}
          onChange={(event) => onChange({ status: event.target.value as BlogArticleDraft["status"] })}
          value={value.status}
        >
          {BLOG_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      {value.status === "scheduled" ? (
        <div className={styles.field}>
          <label htmlFor={fieldId("scheduledAt")}>Дата публикации</label>
          <input
            aria-describedby={errors.scheduledAt ? scheduledAtErrorId : undefined}
            aria-invalid={Boolean(errors.scheduledAt)}
            id={fieldId("scheduledAt")}
            onChange={(event) => onChange({ scheduledAt: event.target.value })}
            type="datetime-local"
            value={value.scheduledAt}
          />
          {errors.scheduledAt ? (
            <p className={styles.fieldError} id={scheduledAtErrorId}>
              {errors.scheduledAt}
            </p>
          ) : null}
        </div>
      ) : null}
      {value.status === "published" ? (
        <div className={styles.field}>
          <label htmlFor={fieldId("publishedAt")}>Дата публикации</label>
          <input
            id={fieldId("publishedAt")}
            onChange={(event) => onChange({ publishedAt: event.target.value })}
            type="date"
            value={value.publishedAt ?? ""}
          />
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor={fieldId("updatedAt")}>Последнее обновление</label>
        <input id={fieldId("updatedAt")} readOnly type="date" value={value.updatedAt ?? ""} />
      </div>
    </fieldset>
  );
}
