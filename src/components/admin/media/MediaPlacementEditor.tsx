"use client";

import { type FormEvent, useMemo, useState } from "react";

import type { MediaPlacementRecord, MediaPublicationConsent, MediaRecord } from "@/admin/domain";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerHeader,
  AdminDrawerSection,
  useAdminDrawerClose,
} from "@/components/admin/drawer";
import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";

import { MediaPicker } from "./MediaPicker";

type MediaPlacementEditorProps = {
  assets: MediaRecord[];
  onClose: () => void;
  onReplaced: (placementId: string, mediaAssetId: string) => void;
  placement: MediaPlacementRecord;
};

type UploadResult = {
  height?: number;
  mimeType?: string;
  path?: string;
  publicUrl?: string;
  size?: number;
  width?: number;
};

type MediaPlacementDraft = {
  altText: string;
  consent: MediaPublicationConsent;
  file?: File;
  folder: string;
  isPublished: boolean;
  name: string;
  selectedAssetId: string;
};

function CancelButton({ disabled, onClose }: { disabled: boolean; onClose: () => void }) {
  const requestClose = useAdminDrawerClose() ?? onClose;

  return (
    <button className="admin-secondary-button" disabled={disabled} onClick={requestClose} type="button">
      Отмена
    </button>
  );
}

export function MediaPlacementEditor({ assets, onClose, onReplaced, placement }: MediaPlacementEditorProps) {
  const eligibleAssets = useMemo(
    () => assets.filter(
      (asset) => asset.type === "Фото" && (asset.status === "Готово" || asset.id === placement.mediaAssetId),
    ),
    [assets, placement.mediaAssetId],
  );
  const [selectedAssetId, setSelectedAssetId] = useState(placement.mediaAssetId);
  const [file, setFile] = useState<File>();
  const [name, setName] = useState("");
  const [altText, setAltText] = useState("");
  const [folder, setFolder] = useState("gallery");
  const [consent, setConsent] = useState<MediaPublicationConsent>("unknown");
  const [isPublished, setIsPublished] = useState(placement.isPublished);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState<MediaPlacementDraft>(() => ({
    altText: "",
    consent: "unknown",
    file: undefined,
    folder: "gallery",
    isPublished: placement.isPublished,
    name: "",
    selectedAssetId: placement.mediaAssetId,
  }));
  const hasUnsavedChanges =
    altText !== savedDraft.altText ||
    consent !== savedDraft.consent ||
    file !== savedDraft.file ||
    folder !== savedDraft.folder ||
    isPublished !== savedDraft.isPublished ||
    name !== savedDraft.name ||
    selectedAssetId !== savedDraft.selectedAssetId;

  async function createUploadedAsset(authorization: string | undefined) {
    if (!file || !name.trim() || !altText.trim() || !["granted", "not_required"].includes(consent)) {
      throw new Error("Для нового изображения укажите файл, название, alt и подтверждение прав на публикацию.");
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", folder);
    const uploadResponse = await fetch("/api/admin/media", {
      body: formData,
      headers: authorization ? { Authorization: authorization } : undefined,
      method: "POST",
    });
    const upload = (await uploadResponse.json().catch(() => null)) as (UploadResult & { error?: string }) | null;
    if (!uploadResponse.ok || !upload?.publicUrl) throw new Error(upload?.error ?? "Не удалось загрузить файл.");

    const mediaAssetId = `media-${crypto.randomUUID()}`;
    const record: MediaRecord = {
      altText: altText.trim(),
      dimensions: upload.width && upload.height ? `${upload.width}x${upload.height}` : "",
      folder,
      id: mediaAssetId,
      name: name.trim(),
      publicationConsent: consent,
      size: `${upload.size ?? file.size} B`,
      status: "Готово",
      type: upload.mimeType === "application/pdf" ? "Документ" : "Фото",
      uploadedAt: new Date().toISOString().slice(0, 10),
      url: upload.publicUrl,
      usage: [],
    };
    const persistResponse = await fetch("/api/admin/records", {
      body: JSON.stringify({ audit: { action: "media.asset" }, record, type: "media" }),
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!persistResponse.ok) {
      if (upload.path) {
        await fetch("/api/admin/media", {
          body: JSON.stringify({ path: upload.path }),
          headers: {
            ...(authorization ? { Authorization: authorization } : {}),
            "Content-Type": "application/json",
          },
          method: "DELETE",
        }).catch(() => undefined);
      }
      throw new Error("Файл загружен, но карточку медиа сохранить не удалось.");
    }
    return mediaAssetId;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const authorization = await getAdminAuthorizationHeader();
      const mediaAssetId = file ? await createUploadedAsset(authorization) : selectedAssetId;
      if (!mediaAssetId) throw new Error("Выберите изображение из медиатеки или загрузите новое.");

      const response = await fetch("/api/admin/media/placements", {
        body: JSON.stringify({ isPublished, mediaAssetId, placementId: placement.id }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Не удалось заменить изображение.");
      onReplaced(placement.id, mediaAssetId);
      setSavedDraft({ altText, consent, file, folder, isPublished, name, selectedAssetId });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось заменить изображение.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminDrawer
      ariaLabelledBy="media-placement-editor-title"
      className="admin-drawer-wide"
      hasUnsavedChanges={hasUnsavedChanges}
      onClose={onClose}
    >
      <AdminDrawerHeader
        kicker="Media placement"
        onClose={onClose}
        title={`Заменить изображение: ${placement.placementKey}`}
        titleId="media-placement-editor-title"
      >
        <p>{placement.pageKey} · {placement.slotKey} · {placement.locale?.toUpperCase() ?? "Все локали"}</p>
      </AdminDrawerHeader>
      <form aria-busy={isSaving} className="admin-drawer-form" onSubmit={handleSubmit}>
        <AdminDrawerBody>
          <AdminDrawerSection title="Из медиатеки">
            {file ? (
              <p>Для размещения будет использован новый загружаемый файл.</p>
            ) : (
              <MediaPicker
                assets={eligibleAssets}
                getDisabledReason={() => "Нужны alt-текст и подтвержденные права на публикацию."}
                isAssetDisabled={(asset) =>
                  isSaving ||
                  (asset.id !== placement.mediaAssetId &&
                    (!asset.altText || !["granted", "not_required"].includes(asset.publicationConsent ?? "unknown")))
                }
                label="Изображение"
                onChange={(asset) => setSelectedAssetId(asset.id)}
                selectedAssetId={selectedAssetId}
              />
            )}
          </AdminDrawerSection>

          <AdminDrawerSection title="Или загрузить новое">
            <div className="admin-content-form-grid">
              <label className="admin-form-wide">
                Файл
                <input
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={isSaving}
                  onChange={(event) => setFile(event.target.files?.[0])}
                  type="file"
                />
              </label>
              <label>
                Название
                <input disabled={!file || isSaving} onChange={(event) => setName(event.target.value)} type="text" value={name} />
              </label>
              <label>
                Папка
                <select disabled={!file || isSaving} onChange={(event) => setFolder(event.target.value)} value={folder}>
                  {['services', 'blog', 'certificates', 'gallery', 'media'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="admin-form-wide">
                Alt-текст
                <textarea disabled={!file || isSaving} onChange={(event) => setAltText(event.target.value)} rows={3} value={altText} />
              </label>
              <label>
                Права на публикацию
                <select disabled={!file || isSaving} onChange={(event) => setConsent(event.target.value as MediaPublicationConsent)} value={consent}>
                  <option value="unknown">Не проверено</option>
                  <option value="granted">Разрешено автором</option>
                  <option value="not_required">Не требуется</option>
                  <option value="denied">Запрещено</option>
                </select>
              </label>
            </div>
          </AdminDrawerSection>
          <AdminDrawerSection title="Публикация">
            <label className="admin-checkbox-row">
              <input checked={isPublished} disabled={isSaving} onChange={(event) => setIsPublished(event.target.checked)} type="checkbox" />
              Показывать это изображение в данном месте на публичном сайте
            </label>
          </AdminDrawerSection>
          {error ? <p className="admin-form-alert" role="alert">{error}</p> : null}
        </AdminDrawerBody>
        <AdminDrawerFooter>
          <button disabled={isSaving} type="submit">{isSaving ? "Замена..." : "Применить к этому месту"}</button>
          <CancelButton disabled={isSaving} onClose={onClose} />
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
  );
}
