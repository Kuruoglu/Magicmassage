"use client";

import type { Editor } from "@tiptap/react";
import { useState } from "react";

import { isSafeArticleLink } from "./article-safety";
import styles from "./BlogArticleEditor.module.css";
import type { BlogMediaOption } from "./types";

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  text: string;
  toggle?: boolean;
};

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  text,
  toggle = true,
}: ToolbarButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={toggle ? active : undefined}
      className={styles.toolbarButton}
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      title={label}
      type="button"
    >
      {text}
    </button>
  );
}

export type BlogEditorToolbarProps = {
  editor: Editor;
  idPrefix?: string;
  mediaOptions?: readonly BlogMediaOption[];
};

export function BlogEditorToolbar({ editor, idPrefix = "blog-editor", mediaOptions = [] }: BlogEditorToolbarProps) {
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  function openLinkEditor() {
    setLinkUrl(String(editor.getAttributes("link").href ?? ""));
    setLinkError("");
    setIsLinkEditorOpen(true);
  }

  function applyLink() {
    const nextUrl = linkUrl.trim();

    if (!isSafeArticleLink(nextUrl)) {
      setLinkError("Введите внутреннюю ссылку или адрес с http, https, mailto или tel.");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: nextUrl, rel: "noopener noreferrer", target: "_blank" })
      .run();
    setIsLinkEditorOpen(false);
    setLinkError("");
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setIsLinkEditorOpen(false);
    setLinkError("");
  }

  const headingValue = editor.isActive("heading", { level: 2 })
    ? "2"
    : editor.isActive("heading", { level: 3 })
      ? "3"
      : editor.isActive("heading", { level: 4 })
        ? "4"
        : "paragraph";

  return (
    <div className={`${styles.toolbar} admin-blog-editor-toolbar`} role="toolbar" aria-label="Форматирование статьи">
      <label className={styles.visuallyHidden} htmlFor={`${idPrefix}-heading`}>
        Стиль абзаца
      </label>
      <select
        aria-label="Стиль абзаца"
        className={styles.headingSelect}
        id={`${idPrefix}-heading`}
        onChange={(event) => {
          const level = event.target.value;

          if (level === "paragraph") {
            editor.chain().focus().setParagraph().run();
            return;
          }

          editor.chain().focus().setHeading({ level: Number(level) as 2 | 3 | 4 }).run();
        }}
        title="Стиль абзаца"
        value={headingValue}
      >
        <option value="paragraph">Абзац</option>
        <option value="2">Заголовок 2</option>
        <option value="3">Заголовок 3</option>
        <option value="4">Заголовок 4</option>
      </select>

      <span aria-hidden="true" className={styles.toolbarDivider} />
      <ToolbarButton
        active={editor.isActive("bold")}
        label="Полужирный"
        onClick={() => editor.chain().focus().toggleBold().run()}
        text="B"
      />
      <ToolbarButton
        active={editor.isActive("italic")}
        label="Курсив"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        text="I"
      />
      <ToolbarButton
        active={editor.isActive("underline")}
        label="Подчеркнутый"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        text="U"
      />
      <ToolbarButton
        active={editor.isActive("strike")}
        label="Зачеркнутый"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        text="S"
      />

      <select
        aria-label="Шрифт"
        className={styles.headingSelect}
        onChange={(event) => {
          const family = event.target.value;
          if (family) editor.chain().focus().setFontFamily(family).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        value={String(editor.getAttributes("textStyle").fontFamily ?? "")}
      >
        <option value="">Шрифт</option>
        <option value="Arial">Arial</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
      </select>
      <select
        aria-label="Размер текста"
        className={styles.headingSelect}
        onChange={(event) => {
          const size = event.target.value;
          if (size) editor.chain().focus().setFontSize(size).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
        value={String(editor.getAttributes("textStyle").fontSize ?? "")}
      >
        <option value="">Размер</option>
        {[14, 16, 18, 20, 24].map((size) => <option key={size} value={`${size}px`}>{size}</option>)}
      </select>

      <span aria-hidden="true" className={styles.toolbarDivider} />
      <ToolbarButton
        active={editor.isActive("bulletList")}
        label="Маркированный список"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        text="UL"
      />
      <ToolbarButton
        active={editor.isActive("orderedList")}
        label="Нумерованный список"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        text="OL"
      />
      <ToolbarButton
        active={editor.isActive("blockquote")}
        label="Цитата"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        text="Quote"
      />
      <ToolbarButton active={editor.isActive("link")} label="Ссылка" onClick={openLinkEditor} text="Link" />
      <ToolbarButton label="Разделитель" onClick={() => editor.chain().focus().setHorizontalRule().run()} text="—" toggle={false} />
      {mediaOptions.length > 0 ? (
        <select
          aria-label="Вставить изображение из медиатеки"
          className={styles.headingSelect}
          onChange={(event) => {
            const media = mediaOptions.find((item) => item.url === event.target.value);
            if (media) editor.chain().focus().setImage({ alt: media.alt, src: media.url, title: media.label }).run();
            event.target.value = "";
          }}
          value=""
        >
          <option value="">Изображение</option>
          {mediaOptions.map((media) => <option key={media.url} value={media.url}>{media.label}</option>)}
        </select>
      ) : null}

      <span aria-hidden="true" className={styles.toolbarDivider} />
      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        label="Выровнять по левому краю"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        text="Left"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        label="Выровнять по центру"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        text="Center"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: "right" })}
        label="Выровнять по правому краю"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        text="Right"
      />
      <ToolbarButton
        active={editor.isActive({ textAlign: "justify" })}
        label="Выровнять по ширине"
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        text="Justify"
      />

      <span aria-hidden="true" className={styles.toolbarDivider} />
      <ToolbarButton
        disabled={!editor.can().chain().focus().undo().run()}
        label="Отменить"
        onClick={() => editor.chain().focus().undo().run()}
        text="Undo"
        toggle={false}
      />
      <ToolbarButton
        disabled={!editor.can().chain().focus().redo().run()}
        label="Повторить"
        onClick={() => editor.chain().focus().redo().run()}
        text="Redo"
        toggle={false}
      />

      {isLinkEditorOpen ? (
        <div className={styles.linkEditor} role="group" aria-label="Настройка ссылки">
          <label htmlFor={`${idPrefix}-link`}>Адрес ссылки</label>
          <div className={styles.linkEditorControls}>
            <input
              aria-describedby={linkError ? `${idPrefix}-link-error` : undefined}
              aria-invalid={Boolean(linkError)}
              autoFocus
              id={`${idPrefix}-link`}
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }

                if (event.key === "Escape") {
                  setIsLinkEditorOpen(false);
                }
              }}
              placeholder="https://example.com"
              type="url"
              value={linkUrl}
            />
            <button className={styles.secondaryButton} onClick={applyLink} type="button">
              Применить
            </button>
            {editor.isActive("link") ? (
              <button className={styles.secondaryButton} onClick={removeLink} type="button">
                Удалить
              </button>
            ) : null}
            <button
              aria-label="Закрыть настройку ссылки"
              className={styles.iconButton}
              onClick={() => setIsLinkEditorOpen(false)}
              title="Закрыть"
              type="button"
            >
              X
            </button>
          </div>
          {linkError ? (
            <p className={styles.fieldError} id={`${idPrefix}-link-error`} role="alert">
              {linkError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
