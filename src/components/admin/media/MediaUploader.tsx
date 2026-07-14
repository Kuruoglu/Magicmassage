"use client";

import { type FormEvent, useId, useRef, useState } from "react";

import type { MediaPublicationConsent, MediaRecord } from "@/admin/domain";

import styles from "./MediaComponents.module.css";

const DEFAULT_FOLDERS = ["services", "blog", "certificates", "gallery", "media"] as const;
const PUBLISHABLE_CONSENTS: readonly MediaPublicationConsent[] = ["granted", "not_required"];

export type MediaUploadRequest = Pick<MediaRecord, "altText" | "folder" | "name" | "type"> & {
  file: File;
  publicationConsent: MediaPublicationConsent;
};

export type MediaUploaderProps = {
  accept?: string;
  cancelLabel?: string;
  defaultFolder?: string;
  disabled?: boolean;
  error?: string;
  folders?: readonly string[];
  isUploading?: boolean;
  maxFileSizeBytes?: number;
  onCancel?: () => void;
  onUpload: (request: MediaUploadRequest) => Promise<void> | void;
  resetAfterUpload?: boolean;
  submitLabel?: string;
};

function fileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function MediaUploader({
  accept = "image/jpeg,image/png,image/webp,image/avif,application/pdf",
  cancelLabel = "Отмена",
  defaultFolder,
  disabled = false,
  error = "",
  folders = DEFAULT_FOLDERS,
  isUploading = false,
  maxFileSizeBytes,
  onCancel,
  onUpload,
  resetAfterUpload = true,
  submitLabel = "Загрузить",
}: MediaUploaderProps) {
  const instanceId = useId().replace(/:/g, "");
  const formRef = useRef<HTMLFormElement>(null);
  const initialFolder = defaultFolder && folders.includes(defaultFolder) ? defaultFolder : (folders[0] ?? "media");
  const [file, setFile] = useState<File>();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState(initialFolder);
  const [altText, setAltText] = useState("");
  const [publicationConsent, setPublicationConsent] = useState<MediaPublicationConsent>("unknown");
  const [internalError, setInternalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pending = disabled || isUploading || isSubmitting;
  const visibleError = error || internalError;

  function resetForm() {
    formRef.current?.reset();
    setFile(undefined);
    setName("");
    setFolder(initialFolder);
    setAltText("");
    setPublicationConsent("unknown");
    setInternalError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInternalError("");

    if (!file) {
      setInternalError("Выберите файл для загрузки.");
      return;
    }
    if (maxFileSizeBytes && file.size > maxFileSizeBytes) {
      setInternalError(`Размер файла не должен превышать ${Math.ceil(maxFileSizeBytes / 1024 / 1024)} МБ.`);
      return;
    }
    if (!name.trim() || !folder.trim() || !altText.trim()) {
      setInternalError("Заполните название, папку и alt-текст.");
      return;
    }
    if (!PUBLISHABLE_CONSENTS.includes(publicationConsent)) {
      setInternalError("Подтвердите права на публикацию файла.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpload({
        altText: altText.trim(),
        file,
        folder: folder.trim(),
        name: name.trim(),
        publicationConsent,
        type: file.type === "application/pdf" ? "Документ" : "Фото",
      });
      if (resetAfterUpload) resetForm();
    } catch (uploadError) {
      setInternalError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить файл.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      aria-label="Загрузка медиа"
      className={styles.uploader}
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <div className={styles.uploadGrid}>
        <label className={`${styles.uploadField} ${styles.wide}`} htmlFor={`${instanceId}-file`}>
          <span>Файл</span>
          <input
            accept={accept}
            aria-describedby={`${instanceId}-file-hint`}
            disabled={pending}
            id={`${instanceId}-file`}
            onChange={(event) => {
              const nextFile = event.target.files?.[0];
              setFile(nextFile);
              setInternalError("");
              if (nextFile && !name.trim()) setName(fileNameWithoutExtension(nextFile.name));
            }}
            type="file"
          />
          <span className={styles.fieldHint} id={`${instanceId}-file-hint`}>
            JPEG, PNG, WebP, AVIF или PDF{maxFileSizeBytes ? `, до ${Math.ceil(maxFileSizeBytes / 1024 / 1024)} МБ` : ""}.
          </span>
        </label>

        <label className={styles.uploadField} htmlFor={`${instanceId}-name`}>
          <span>Название</span>
          <input
            disabled={pending}
            id={`${instanceId}-name`}
            onChange={(event) => setName(event.target.value)}
            type="text"
            value={name}
          />
        </label>
        <label className={styles.uploadField} htmlFor={`${instanceId}-folder`}>
          <span>Папка</span>
          <select
            disabled={pending}
            id={`${instanceId}-folder`}
            onChange={(event) => setFolder(event.target.value)}
            value={folder}
          >
            {folders.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={`${styles.uploadField} ${styles.wide}`} htmlFor={`${instanceId}-alt`}>
          <span>Alt-текст или описание документа</span>
          <textarea
            disabled={pending}
            id={`${instanceId}-alt`}
            onChange={(event) => setAltText(event.target.value)}
            rows={3}
            value={altText}
          />
        </label>
        <label className={styles.uploadField} htmlFor={`${instanceId}-consent`}>
          <span>Права на публикацию</span>
          <select
            disabled={pending}
            id={`${instanceId}-consent`}
            onChange={(event) => setPublicationConsent(event.target.value as MediaPublicationConsent)}
            value={publicationConsent}
          >
            <option value="unknown">Не проверено</option>
            <option value="granted">Разрешено автором</option>
            <option value="not_required">Не требуется</option>
            <option value="denied">Запрещено</option>
          </select>
        </label>
      </div>

      {visibleError ? <p className={styles.alert} role="alert">{visibleError}</p> : null}

      <div className={styles.actions}>
        <button className={styles.primaryButton} disabled={pending} type="submit">
          {isUploading || isSubmitting ? "Загрузка..." : submitLabel}
        </button>
        {onCancel ? (
          <button className={styles.secondaryButton} disabled={pending} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
