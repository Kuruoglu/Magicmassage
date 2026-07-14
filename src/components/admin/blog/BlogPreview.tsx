"use client";

import { useMemo } from "react";

import { sanitizeArticleHtml } from "./article-safety";
import styles from "./BlogArticleEditor.module.css";

export type BlogPreviewProps = {
  content: string;
  excerpt?: string;
  title?: string;
};

export function BlogPreview({ content, excerpt = "", title = "" }: BlogPreviewProps) {
  const sanitizedHtml = useMemo(() => sanitizeArticleHtml(content), [content]);

  return (
    <article>
      <h1>{title.trim() || "Заголовок статьи"}</h1>
      {excerpt.trim() ? <p className={styles.previewExcerpt}>{excerpt}</p> : null}
      <div className={styles.previewContent} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
    </article>
  );
}
