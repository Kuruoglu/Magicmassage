"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { type KeyboardEvent, useState } from "react";

import styles from "./BlogArticleEditor.module.css";
import { BlogEditorToolbar } from "./BlogEditorToolbar";
import { BlogPreview } from "./BlogPreview";
import type { BlogMediaOption } from "./types";

export type BlogEditorProps = {
  content: string;
  contentError?: string;
  editor: Editor | null;
  excerpt?: string;
  idPrefix: string;
  mediaOptions?: readonly BlogMediaOption[];
  title?: string;
};

export function BlogEditor({
  content,
  contentError,
  editor,
  excerpt = "",
  idPrefix,
  mediaOptions = [],
  title = "",
}: BlogEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const nextMode = mode === "edit" ? "preview" : "edit";
    setMode(nextMode);
    document.getElementById(`${idPrefix}-${nextMode}-tab`)?.focus();
  }

  return (
    <section aria-labelledby={`${idPrefix}-article-body-heading`} className={styles.editorSection}>
      <div className={styles.editorSectionHeader}>
        <h2 id={`${idPrefix}-article-body-heading`}>Содержание</h2>
        <div aria-label="Режим редактора" className={styles.modeSwitch} role="tablist">
          <button
            aria-controls={`${idPrefix}-edit-panel`}
            aria-selected={mode === "edit"}
            className={styles.modeButton}
            id={`${idPrefix}-edit-tab`}
            onClick={() => setMode("edit")}
            onKeyDown={handleModeKeyDown}
            role="tab"
            tabIndex={mode === "edit" ? 0 : -1}
            type="button"
          >
            Редактор
          </button>
          <button
            aria-controls={`${idPrefix}-preview-panel`}
            aria-selected={mode === "preview"}
            className={styles.modeButton}
            id={`${idPrefix}-preview-tab`}
            onClick={() => setMode("preview")}
            onKeyDown={handleModeKeyDown}
            role="tab"
            tabIndex={mode === "preview" ? 0 : -1}
            type="button"
          >
            Предпросмотр
          </button>
        </div>
      </div>

      <div
        aria-labelledby={`${idPrefix}-edit-tab`}
        hidden={mode !== "edit"}
        id={`${idPrefix}-edit-panel`}
        role="tabpanel"
      >
        {editor ? (
          <BlogEditorToolbar editor={editor} idPrefix={`${idPrefix}-toolbar`} mediaOptions={mediaOptions} />
        ) : (
          <div className={styles.toolbarPlaceholder} />
        )}
        <div className={styles.editorFrame}>
          <EditorContent editor={editor} />
        </div>
      </div>

      <div
        aria-labelledby={`${idPrefix}-preview-tab`}
        className={styles.preview}
        hidden={mode !== "preview"}
        id={`${idPrefix}-preview-panel`}
        role="tabpanel"
      >
        <BlogPreview content={content} excerpt={excerpt} title={title} />
      </div>
      {contentError ? (
        <p className={styles.fieldError} id={`${idPrefix}-content-error`}>
          {contentError}
        </p>
      ) : null}
    </section>
  );
}
