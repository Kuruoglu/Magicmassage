"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./BlogArticleEditor.module.css";
import type {
  BlogArticleDraft,
  BlogArticlePatchHandler,
  BlogArticleValidationErrors,
} from "./types";

function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

export type BlogOrganizationPanelProps = {
  authorOptions?: readonly string[];
  categoryOptions?: readonly string[];
  errors?: BlogArticleValidationErrors;
  idPrefix: string;
  onChange: BlogArticlePatchHandler;
  value: BlogArticleDraft;
};

export function BlogOrganizationPanel({
  authorOptions = [],
  categoryOptions = [],
  errors = {},
  idPrefix,
  onChange,
  value,
}: BlogOrganizationPanelProps) {
  const [tagsInput, setTagsInput] = useState(value.tags.join(", "));
  const tagsInputRef = useRef<HTMLInputElement>(null);
  const fieldId = (field: keyof BlogArticleDraft) => `${idPrefix}-${field}`;
  const errorId = (field: keyof BlogArticleDraft) => `${fieldId(field)}-error`;

  useEffect(() => {
    if (document.activeElement !== tagsInputRef.current) setTagsInput(value.tags.join(", "));
  }, [value.tags]);

  return (
    <fieldset className={styles.fieldGroup}>
      <legend>Организация</legend>
      <div className={styles.field}>
        <label htmlFor={fieldId("slug")}>Slug</label>
        <input
          aria-describedby={errors.slug ? errorId("slug") : undefined}
          aria-invalid={Boolean(errors.slug)}
          autoCapitalize="none"
          autoComplete="off"
          id={fieldId("slug")}
          onChange={(event) => onChange({ slug: event.target.value.toLowerCase() })}
          placeholder="article-url"
          spellCheck={false}
          value={value.slug}
        />
        {errors.slug ? (
          <p className={styles.fieldError} id={errorId("slug")}>
            {errors.slug}
          </p>
        ) : null}
      </div>
      <div className={styles.field}>
        <label htmlFor={fieldId("category")}>Категория</label>
        <input
          aria-describedby={errors.category ? errorId("category") : undefined}
          aria-invalid={Boolean(errors.category)}
          id={fieldId("category")}
          list={`${idPrefix}-category-options`}
          onChange={(event) => onChange({ category: event.target.value })}
          value={value.category}
        />
        <datalist id={`${idPrefix}-category-options`}>
          {categoryOptions.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        {errors.category ? (
          <p className={styles.fieldError} id={errorId("category")}>
            {errors.category}
          </p>
        ) : null}
      </div>
      <div className={styles.field}>
        <label htmlFor={fieldId("tags")}>Теги</label>
        <input
          id={fieldId("tags")}
          onChange={(event) => {
            setTagsInput(event.target.value);
            onChange({ tags: parseTags(event.target.value) });
          }}
          placeholder="массаж, здоровье, советы"
          ref={tagsInputRef}
          value={tagsInput}
        />
        <span className={styles.fieldHint}>Разделяйте теги запятыми.</span>
      </div>
      <div className={styles.field}>
        <label htmlFor={fieldId("author")}>Автор</label>
        <input
          aria-describedby={errors.author ? errorId("author") : undefined}
          aria-invalid={Boolean(errors.author)}
          id={fieldId("author")}
          list={`${idPrefix}-author-options`}
          onChange={(event) => onChange({ author: event.target.value })}
          value={value.author}
        />
        <datalist id={`${idPrefix}-author-options`}>
          {authorOptions.map((author) => (
            <option key={author} value={author} />
          ))}
        </datalist>
        {errors.author ? (
          <p className={styles.fieldError} id={errorId("author")}>
            {errors.author}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
