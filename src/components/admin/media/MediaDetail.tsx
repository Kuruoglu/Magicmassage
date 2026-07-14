"use client";

import { useId } from "react";

import type { MediaPlacementRecord, MediaPublicationConsent, MediaRecord } from "@/admin/domain";

import styles from "./MediaComponents.module.css";
import { MediaThumbnail } from "./MediaThumbnail";

const CONSENT_LABELS: Record<MediaPublicationConsent, string> = {
  denied: "Публикация запрещена",
  granted: "Разрешено автором",
  not_required: "Согласие не требуется",
  unknown: "Не проверено",
};

export type MediaDetailProps = {
  asset: MediaRecord;
  editLabel?: string;
  onEdit?: (asset: MediaRecord) => void;
  onReplacePlacement?: (placement: MediaPlacementRecord, asset: MediaRecord) => void;
  replacePlacementLabel?: string;
  showHeader?: boolean;
};

export function MediaDetail({
  asset,
  editLabel = "Редактировать",
  onEdit,
  onReplacePlacement,
  replacePlacementLabel = "Заменить в этом месте",
  showHeader = true,
}: MediaDetailProps) {
  const headingId = `media-detail-${useId().replace(/:/g, "")}`;
  const placements = asset.placements ?? [];
  const localizedAltTexts = Object.entries(asset.altTexts ?? {}).filter((entry) => entry[1]);

  return (
    <section aria-labelledby={headingId} className={styles.detail}>
      {showHeader ? <header className={styles.detailHeader}>
        <div>
          <h2 id={headingId}>{asset.name}</h2>
          <p>{asset.type} · {asset.status}</p>
        </div>
        {onEdit ? (
          <button className={styles.secondaryButton} onClick={() => onEdit(asset)} type="button">
            {editLabel}
          </button>
        ) : null}
      </header> : null}

      {!showHeader && onEdit ? (
        <div className={styles.detailActions}>
          <button className={styles.secondaryButton} onClick={() => onEdit(asset)} type="button">
            {editLabel}
          </button>
        </div>
      ) : null}

      <MediaThumbnail asset={asset} className={styles.detailPreview} sizes="(max-width: 640px) 100vw, 520px" />

      <dl className={styles.detailList}>
        <div>
          <dt>URL</dt>
          <dd>{asset.url}</dd>
        </div>
        <div>
          <dt>Alt-текст</dt>
          <dd>{asset.altText || "Alt-текст нужно заполнить перед публикацией."}</dd>
        </div>
        {localizedAltTexts.map(([locale, altText]) => (
          <div key={locale}>
            <dt>Alt · {locale.toUpperCase()}</dt>
            <dd>{altText}</dd>
          </div>
        ))}
        <div>
          <dt>Статус</dt>
          <dd><span className={styles.status} data-status={asset.status}>{asset.status}</span></dd>
        </div>
        <div>
          <dt>Папка</dt>
          <dd>{asset.folder}</dd>
        </div>
        <div>
          <dt>Размер</dt>
          <dd>{asset.size || "Не указан"}</dd>
        </div>
        <div>
          <dt>Разрешение</dt>
          <dd>{asset.dimensions || "Не указано"}</dd>
        </div>
        <div>
          <dt>Загружено</dt>
          <dd>{asset.uploadedAt}</dd>
        </div>
        <div>
          <dt>Права на публикацию</dt>
          <dd>{CONSENT_LABELS[asset.publicationConsent ?? "unknown"]}</dd>
        </div>
      </dl>

      <section className={styles.placements} aria-labelledby={`${headingId}-placements`}>
        <h3 id={`${headingId}-placements`}>Места использования</h3>
        {placements.length > 0 ? (
          <ul className={styles.placementList}>
            {placements.map((placement) => (
              <li className={styles.placementItem} key={placement.id}>
                <div className={styles.placementCopy}>
                  <strong>{placement.placementKey}</strong>
                  <span>
                    {placement.pageKey} · {placement.slotKey} · {placement.locale?.toUpperCase() ?? "Все локали"}
                    {placement.isPublished ? " · Опубликовано" : " · Не опубликовано"}
                  </span>
                </div>
                {onReplacePlacement ? (
                  <button
                    className={styles.textButton}
                    onClick={() => onReplacePlacement(placement, asset)}
                    type="button"
                  >
                    {replacePlacementLabel}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : asset.usage.length > 0 ? (
          <ul className={styles.placementList}>
            {asset.usage.map((usage) => <li className={styles.placementItem} key={usage}>{usage}</li>)}
          </ul>
        ) : (
          <p>Файл пока не привязан к страницам.</p>
        )}
      </section>
    </section>
  );
}
