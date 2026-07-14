"use client";

import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  type FormEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getArticleText,
  sanitizeArticleDraft,
  serializeArticleDraft,
  validateArticleDraft,
} from "./article-safety";
import styles from "./BlogArticleEditor.module.css";
import { BlogEditor } from "./BlogEditor";
import { BlogOrganizationPanel } from "./BlogOrganizationPanel";
import { BlogPublishPanel } from "./BlogPublishPanel";
import { BlogSeoPanel } from "./BlogSeoPanel";
import {
  type BlogArticleCancelContext,
  type BlogArticleDraft,
  type BlogArticlePatch,
  type BlogArticleValidationErrors,
  type BlogMediaOption,
  isBlogPublicationStatus,
} from "./types";

const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: false,
    underline: false,
  }),
  Link.configure({
    HTMLAttributes: {
      rel: "noopener noreferrer",
      target: "_blank",
    },
    autolink: true,
    defaultProtocol: "https",
    openOnClick: false,
  }),
  Underline,
  Image.configure({ allowBase64: false }),
  TextStyle,
  FontFamily,
  FontSize,
  TextAlign.configure({
    alignments: ["left", "center", "right", "justify"],
    types: ["heading", "paragraph"],
  }),
];

export type BlogArticleEditorProps = {
  authorOptions?: readonly string[];
  categoryOptions?: readonly string[];
  className?: string;
  isSaving?: boolean;
  mediaOptions?: readonly BlogMediaOption[];
  onAutosave?: (value: BlogArticleDraft) => Promise<void> | void;
  onCancel: (context: BlogArticleCancelContext) => void;
  onChange: (value: BlogArticleDraft) => void;
  onSave: (value: BlogArticleDraft) => Promise<void> | void;
  savedValue?: BlogArticleDraft;
  value: BlogArticleDraft;
};

function errorDescriptionId(fieldId: string, hasError: boolean): string | undefined {
  return hasError ? `${fieldId}-error` : undefined;
}

function fieldIdForInstance(instanceId: string, field: keyof BlogArticleDraft): string {
  return `${instanceId}-${field}`;
}

export function BlogArticleEditor({
  authorOptions = [],
  categoryOptions = [],
  className = "",
  isSaving = false,
  mediaOptions = [],
  onAutosave,
  onCancel,
  onChange,
  onSave,
  savedValue,
  value,
}: BlogArticleEditorProps) {
  const instanceId = useId().replace(/:/g, "");
  const [lastSavedValue, setLastSavedValue] = useState(savedValue ?? value);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storedValidationErrors, setValidationErrors] = useState<BlogArticleValidationErrors>({});
  const onChangeRef = useRef(onChange);
  const onAutosaveRef = useRef(onAutosave);
  const valueRef = useRef(value);
  const validationErrors = useMemo(() => {
    if (!storedValidationErrors.content || !getArticleText(value.content)) {
      return storedValidationErrors;
    }

    const visibleErrors = { ...storedValidationErrors };
    delete visibleErrors.content;
    return visibleErrors;
  }, [storedValidationErrors, value.content]);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    onAutosaveRef.current = onAutosave;
  }, [onAutosave, onChange, value]);

  const editor = useEditor({
    content: value.content,
    editorProps: {
      attributes: {
        "aria-label": "Текст статьи",
        "aria-multiline": "true",
        class: `${styles.editorContent} admin-blog-editor-content`,
        id: fieldIdForInstance(instanceId, "content"),
        role: "textbox",
      },
    },
    extensions: EDITOR_EXTENSIONS,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current({
        ...valueRef.current,
        content: currentEditor.getHTML(),
        editorJson: currentEditor.getJSON() as Record<string, unknown>,
      });
      setSaveError("");
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value.content) {
      editor.commands.setContent(value.content, { emitUpdate: false });
    }
  }, [editor, value.content]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (validationErrors.content) {
      editor.view.dom.setAttribute("aria-describedby", `${instanceId}-content-error`);
      editor.view.dom.setAttribute("aria-invalid", "true");
    } else {
      editor.view.dom.removeAttribute("aria-describedby");
      editor.view.dom.removeAttribute("aria-invalid");
    }
  }, [editor, instanceId, validationErrors.content]);

  const baseline = lastSavedValue;
  const hasUnsavedChanges = useMemo(
    () => serializeArticleDraft(value) !== serializeArticleDraft(baseline),
    [baseline, value],
  );
  const pending = isSaving || isSubmitting;

  useEffect(() => {
    if (!hasUnsavedChanges || !onAutosaveRef.current || pending) return;

    const timer = window.setTimeout(async () => {
      const nextValue = sanitizeArticleDraft(valueRef.current);
      if (
        isBlogPublicationStatus(nextValue.status) &&
        Object.keys(validateArticleDraft(nextValue, mediaOptions)).length > 0
      ) return;

      setAutosaveState("saving");
      try {
        await onAutosaveRef.current?.(nextValue);
        setLastSavedValue(nextValue);
        setAutosaveState("saved");
      } catch {
        setAutosaveState("error");
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [hasUnsavedChanges, mediaOptions, pending, value]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function fieldId(field: keyof BlogArticleDraft): string {
    return fieldIdForInstance(instanceId, field);
  }

  function updateField<Key extends keyof BlogArticleDraft>(field: Key, nextValue: BlogArticleDraft[Key]) {
    updateFields({ [field]: nextValue });
  }

  function updateFields(patch: BlogArticlePatch) {
    onChange({ ...value, ...patch });
    setSaveError("");

    const fieldsWithErrors = Object.keys(patch).filter(
      (field) => validationErrors[field as keyof BlogArticleDraft],
    ) as (keyof BlogArticleDraft)[];
    if (fieldsWithErrors.length > 0) {
      setValidationErrors((current) => {
        const nextErrors = { ...current };
        fieldsWithErrors.forEach((field) => delete nextErrors[field]);
        return nextErrors;
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextValue = sanitizeArticleDraft(value);
    const nextErrors = validateArticleDraft(nextValue, mediaOptions);
    setValidationErrors(nextErrors);
    setSaveError("");

    const firstInvalidField = Object.keys(nextErrors)[0] as keyof BlogArticleDraft | undefined;
    if (firstInvalidField) {
      requestAnimationFrame(() => document.getElementById(fieldId(firstInvalidField))?.focus());
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(nextValue);
      setLastSavedValue(nextValue);
      setAutosaveState("saved");

      if (serializeArticleDraft(nextValue) !== serializeArticleDraft(value)) {
        onChange(nextValue);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить статью.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const rootClassName = [styles.page, "admin-blog-editor-page", className].filter(Boolean).join(" ");

  return (
    <form aria-label="Редактор статьи" className={rootClassName} noValidate onSubmit={handleSubmit}>
      <header className={`${styles.header} admin-blog-editor-header`}>
        <div className={styles.headerTitle}>
          <p>Блог</p>
          <h1>{value.title.trim() || "Новая статья"}</h1>
        </div>
        <div className={styles.headerActions}>
          <span
            aria-live="polite"
            className={styles.saveState}
            data-dirty={hasUnsavedChanges ? "true" : "false"}
            role="status"
          >
            {autosaveState === "saving"
              ? "Сохранение..."
              : autosaveState === "error"
                ? "Ошибка автосохранения"
                : hasUnsavedChanges
                  ? "Есть несохраненные изменения"
                  : "Все изменения сохранены"}
          </span>
          <button
            className={styles.secondaryButton}
            disabled={pending}
            onClick={() => onCancel({ hasUnsavedChanges, value })}
            type="button"
          >
            Отмена
          </button>
          <button className={styles.primaryButton} disabled={pending || !hasUnsavedChanges} type="submit">
            {pending ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </header>

      {Object.keys(validationErrors).length ? (
        <div className={styles.errorSummary} role="alert" tabIndex={-1}>
          <strong>Проверьте обязательные поля.</strong>
          <ul>
            {Object.entries(validationErrors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? (
        <p className={styles.saveError} role="alert">
          {saveError}
        </p>
      ) : null}

      <div className={`${styles.workspace} admin-blog-editor-workspace`}>
        <main className={`${styles.articleColumn} admin-blog-editor-main`}>
          <div className={styles.titleField}>
            <label htmlFor={fieldId("title")}>Заголовок</label>
            <input
              aria-describedby={errorDescriptionId(fieldId("title"), Boolean(validationErrors.title))}
              aria-invalid={Boolean(validationErrors.title)}
              autoComplete="off"
              id={fieldId("title")}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Заголовок статьи"
              value={value.title}
            />
            {validationErrors.title ? (
              <p className={styles.fieldError} id={`${fieldId("title")}-error`}>
                {validationErrors.title}
              </p>
            ) : null}
          </div>

          <div className={styles.excerptField}>
            <div className={styles.labelRow}>
              <label htmlFor={fieldId("excerpt")}>Краткое описание</label>
              <span>{value.excerpt.length}/240</span>
            </div>
            <textarea
              id={fieldId("excerpt")}
              maxLength={240}
              onChange={(event) => updateField("excerpt", event.target.value)}
              placeholder="Короткий анонс для списка статей"
              rows={3}
              value={value.excerpt}
            />
          </div>

          <BlogEditor
            content={value.content}
            contentError={validationErrors.content}
            editor={editor}
            excerpt={value.excerpt}
            idPrefix={instanceId}
            mediaOptions={mediaOptions}
            title={value.title}
          />
        </main>

        <aside aria-label="Настройки статьи" className={`${styles.sidebar} admin-blog-editor-sidebar`}>
          <BlogPublishPanel
            errors={validationErrors}
            idPrefix={instanceId}
            onChange={updateFields}
            value={value}
          />

          <BlogOrganizationPanel
            authorOptions={authorOptions}
            categoryOptions={categoryOptions}
            errors={validationErrors}
            idPrefix={instanceId}
            onChange={updateFields}
            value={value}
          />

          <BlogSeoPanel
            errors={validationErrors}
            idPrefix={instanceId}
            mediaOptions={mediaOptions}
            onChange={updateFields}
            value={value}
          />
        </aside>
      </div>
    </form>
  );
}
