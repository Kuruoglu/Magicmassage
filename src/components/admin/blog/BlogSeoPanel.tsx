"use client";

import Image from "next/image";

import styles from "./BlogArticleEditor.module.css";
import {
  BLOG_LOCALES,
  type BlogArticleDraft,
  type BlogArticlePatchHandler,
  type BlogArticleValidationErrors,
  type BlogMediaOption,
} from "./types";

const LOCALE_LABELS: Record<BlogArticleDraft["locale"], string> = {
  bg: "Български",
  en: "English",
  ru: "Русский",
  ua: "Українська",
};

export type BlogSeoPanelProps = {
  errors?: BlogArticleValidationErrors;
  idPrefix: string;
  mediaOptions?: readonly BlogMediaOption[];
  onChange: BlogArticlePatchHandler;
  value: BlogArticleDraft;
};

export function BlogSeoPanel({
  errors = {},
  idPrefix,
  mediaOptions = [],
  onChange,
  value,
}: BlogSeoPanelProps) {
  const fieldId = (field: keyof BlogArticleDraft) => `${idPrefix}-${field}`;
  const errorId = (field: keyof BlogArticleDraft) => `${fieldId(field)}-error`;

  return (
    <>
      <fieldset className={styles.fieldGroup}>
        <legend>Ссылки и публикация</legend>
        <div className={styles.field}>
          <label htmlFor={fieldId("canonicalUrl")}>Canonical URL</label>
          <input
            aria-describedby={errors.canonicalUrl ? errorId("canonicalUrl") : undefined}
            aria-invalid={Boolean(errors.canonicalUrl)}
            id={fieldId("canonicalUrl")}
            onChange={(event) => onChange({ canonicalUrl: event.target.value })}
            placeholder={`/${value.locale}/blog/${value.slug || "article-slug"}`}
            type="url"
            value={value.canonicalUrl ?? ""}
          />
          {errors.canonicalUrl ? (
            <p className={styles.fieldError} id={errorId("canonicalUrl")}>
              {errors.canonicalUrl}
            </p>
          ) : null}
        </div>
        <div className={styles.field}>
          <span id={`${fieldId("hreflang")}-label`}>Hreflang URLs</span>
          <div aria-labelledby={`${fieldId("hreflang")}-label`} role="group">
            {BLOG_LOCALES.map((locale) => (
              <label key={locale} htmlFor={`${fieldId("hreflang")}-${locale}`}>
                {LOCALE_LABELS[locale]}
                <input
                  id={`${fieldId("hreflang")}-${locale}`}
                  onChange={(event) =>
                    onChange({ hreflang: { ...value.hreflang, [locale]: event.target.value } })
                  }
                  placeholder={`/${locale}/blog/${value.slug || "article-slug"}`}
                  value={value.hreflang?.[locale] ?? ""}
                />
              </label>
            ))}
          </div>
          {errors.hreflang ? <p className={styles.fieldError}>{errors.hreflang}</p> : null}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={fieldId("ogTitle")}>Open Graph title</label>
            <span>{value.ogTitle?.length ?? 0}/70</span>
          </div>
          <input
            aria-invalid={Boolean(errors.ogTitle)}
            id={fieldId("ogTitle")}
            onChange={(event) => onChange({ ogTitle: event.target.value })}
            value={value.ogTitle ?? ""}
          />
          {errors.ogTitle ? <p className={styles.fieldError}>{errors.ogTitle}</p> : null}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={fieldId("ogDescription")}>Open Graph description</label>
            <span>{value.ogDescription?.length ?? 0}/200</span>
          </div>
          <textarea
            aria-invalid={Boolean(errors.ogDescription)}
            id={fieldId("ogDescription")}
            onChange={(event) => onChange({ ogDescription: event.target.value })}
            rows={3}
            value={value.ogDescription ?? ""}
          />
          {errors.ogDescription ? <p className={styles.fieldError}>{errors.ogDescription}</p> : null}
        </div>
        <div className={styles.field}>
          <label htmlFor={fieldId("robotsDirectives")}>Robots</label>
          <select
            id={fieldId("robotsDirectives")}
            onChange={(event) => onChange({ robotsDirectives: event.target.value })}
            value={value.robotsDirectives ?? "noindex,nofollow"}
          >
            <option value="index,follow">index,follow</option>
            <option value="noindex,follow">noindex,follow</option>
            <option value="noindex,nofollow">noindex,nofollow</option>
          </select>
        </div>
        <div aria-label="Предпросмотр публикации в соцсетях" className={styles.socialPreview}>
          {value.coverUrl ? (
            <Image alt={value.coverAlt} height={180} src={value.coverUrl} unoptimized width={320} />
          ) : null}
          <strong>{value.ogTitle?.trim() || value.seoTitle.trim() || value.title.trim() || "Заголовок статьи"}</strong>
          <p>{value.ogDescription?.trim() || value.seoDescription.trim() || value.excerpt.trim()}</p>
        </div>
      </fieldset>

      <fieldset className={styles.fieldGroup}>
        <legend>Обложка и Open Graph image</legend>
        {mediaOptions.length > 0 ? (
          <div className={styles.field}>
            <label htmlFor={`${fieldId("coverUrl")}-library`}>Из медиатеки</label>
            <select
              id={`${fieldId("coverUrl")}-library`}
              onChange={(event) => {
                const media = mediaOptions.find((item) => item.url === event.target.value);
                if (media) onChange({ coverAlt: media.alt, coverUrl: media.url });
              }}
              value={mediaOptions.some((item) => item.url === value.coverUrl) ? value.coverUrl : ""}
            >
              <option value="">Выберите изображение</option>
              {mediaOptions.map((media) => (
                <option key={media.url} value={media.url}>
                  {media.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className={styles.field}>
          <label htmlFor={fieldId("coverUrl")}>URL изображения</label>
          <input
            aria-describedby={errors.coverUrl ? errorId("coverUrl") : undefined}
            aria-invalid={Boolean(errors.coverUrl)}
            id={fieldId("coverUrl")}
            onChange={(event) => onChange({ coverUrl: event.target.value })}
            placeholder="/media/blog/cover.jpg"
            type="url"
            value={value.coverUrl}
          />
          {errors.coverUrl ? (
            <p className={styles.fieldError} id={errorId("coverUrl")}>
              {errors.coverUrl}
            </p>
          ) : null}
        </div>
        <div className={styles.field}>
          <label htmlFor={fieldId("coverAlt")}>Описание изображения</label>
          <input
            aria-describedby={errors.coverAlt ? errorId("coverAlt") : undefined}
            aria-invalid={Boolean(errors.coverAlt)}
            id={fieldId("coverAlt")}
            onChange={(event) => onChange({ coverAlt: event.target.value })}
            value={value.coverAlt}
          />
          {errors.coverAlt ? (
            <p className={styles.fieldError} id={errorId("coverAlt")}>
              {errors.coverAlt}
            </p>
          ) : null}
        </div>
      </fieldset>

      <fieldset className={styles.fieldGroup}>
        <legend>SEO</legend>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={fieldId("seoTitle")}>SEO-заголовок</label>
            <span>{value.seoTitle.length}/70</span>
          </div>
          <input
            aria-describedby={errors.seoTitle ? errorId("seoTitle") : undefined}
            aria-invalid={Boolean(errors.seoTitle)}
            id={fieldId("seoTitle")}
            onChange={(event) => onChange({ seoTitle: event.target.value })}
            value={value.seoTitle}
          />
          {errors.seoTitle ? (
            <p className={styles.fieldError} id={errorId("seoTitle")}>
              {errors.seoTitle}
            </p>
          ) : null}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor={fieldId("seoDescription")}>SEO-описание</label>
            <span>{value.seoDescription.length}/170</span>
          </div>
          <textarea
            aria-describedby={errors.seoDescription ? errorId("seoDescription") : undefined}
            aria-invalid={Boolean(errors.seoDescription)}
            id={fieldId("seoDescription")}
            onChange={(event) => onChange({ seoDescription: event.target.value })}
            rows={4}
            value={value.seoDescription}
          />
          {errors.seoDescription ? (
            <p className={styles.fieldError} id={errorId("seoDescription")}>
              {errors.seoDescription}
            </p>
          ) : null}
        </div>
      </fieldset>
    </>
  );
}
