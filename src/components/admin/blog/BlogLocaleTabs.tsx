"use client";

import { type KeyboardEvent, useRef } from "react";

import styles from "./BlogArticleEditor.module.css";
import { BLOG_LOCALE_LABELS } from "./localized-articles";
import { BLOG_LOCALES, type BlogLocale } from "./types";

const LANGUAGE_NAMES: Record<BlogLocale, string> = {
  bg: "Български",
  en: "English",
  ru: "Русский",
  ua: "Українська",
};

export type BlogLocaleTabsProps = {
  activeLocale: BlogLocale;
  dirtyLocales?: ReadonlySet<BlogLocale>;
  onSelect: (locale: BlogLocale) => void;
  statusByLocale: Partial<Record<BlogLocale, string>>;
};

export function BlogLocaleTabs({ activeLocale, dirtyLocales, onSelect, statusByLocale }: BlogLocaleTabsProps) {
  const buttonRefs = useRef<Partial<Record<BlogLocale, HTMLButtonElement | null>>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, locale: BlogLocale) {
    const currentIndex = BLOG_LOCALES.indexOf(locale);
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % BLOG_LOCALES.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + BLOG_LOCALES.length) % BLOG_LOCALES.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = BLOG_LOCALES.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextLocale = BLOG_LOCALES[nextIndex];
    onSelect(nextLocale);
    requestAnimationFrame(() => buttonRefs.current[nextLocale]?.focus());
  }

  return (
    <nav aria-label="Языковые версии статьи" className={styles.localeTabs} role="tablist">
      {BLOG_LOCALES.map((locale) => {
        const status = statusByLocale[locale] ?? "Нет перевода";
        const isDirty = dirtyLocales?.has(locale) ?? false;

        return (
          <button
            aria-controls="blog-localized-editor-panel"
            aria-label={`${LANGUAGE_NAMES[locale]}. ${status}${isDirty ? ". Есть несохраненные изменения" : ""}`}
            aria-selected={activeLocale === locale}
            className={styles.localeTab}
            data-status={status === "Нет перевода" ? "missing" : "available"}
            id={`blog-locale-tab-${locale}`}
            key={locale}
            onClick={() => onSelect(locale)}
            onKeyDown={(event) => handleKeyDown(event, locale)}
            ref={(node) => {
              buttonRefs.current[locale] = node;
            }}
            role="tab"
            tabIndex={activeLocale === locale ? 0 : -1}
            type="button"
          >
            <span>{BLOG_LOCALE_LABELS[locale]}</span>
            <small>{status}</small>
            {isDirty ? <em>Изменено</em> : null}
          </button>
        );
      })}
    </nav>
  );
}
