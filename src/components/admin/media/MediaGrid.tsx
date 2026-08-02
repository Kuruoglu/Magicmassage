"use client";

import { AdminLink as Link } from "@/components/admin/AdminLink";

import type { MediaRecord } from "@/admin/domain";

import styles from "./MediaComponents.module.css";
import { MediaThumbnail } from "./MediaThumbnail";

export type MediaGridProps = {
  assets: readonly MediaRecord[];
  emptyMessage?: string;
  getAssetHref?: (asset: MediaRecord) => string | undefined;
  label?: string;
  onSelect?: (asset: MediaRecord) => void;
  selectedAssetId?: string;
};

function MediaCardContent({ asset }: { asset: MediaRecord }) {
  const placementCount = asset.placements?.length ?? asset.usage.length;

  return (
    <>
      <MediaThumbnail asset={asset} sizes="(max-width: 640px) 44vw, 220px" />
      <span className={styles.cardCopy}>
        <strong>{asset.name}</strong>
        <span>{asset.folder} · {asset.dimensions || asset.type}</span>
        <span className={styles.cardFooter}>
          <span className={styles.status} data-status={asset.status}>{asset.status}</span>
          <small>{placementCount} мест</small>
        </span>
      </span>
    </>
  );
}

export function MediaGrid({
  assets,
  emptyMessage = "Медиа не найдены.",
  getAssetHref,
  label = "Галерея медиа",
  onSelect,
  selectedAssetId,
}: MediaGridProps) {
  if (assets.length === 0) return <p className={styles.empty}>{emptyMessage}</p>;

  return (
    <div aria-label={label} className={styles.gridRegion} role="region">
      <ul className={styles.grid}>
        {assets.map((asset) => {
          const href = getAssetHref?.(asset);
          const selected = selectedAssetId === asset.id;

          return (
            <li className={styles.card} key={asset.id}>
              {href ? (
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={styles.cardAction}
                  href={href}
                  onClick={() => onSelect?.(asset)}
                >
                  <MediaCardContent asset={asset} />
                </Link>
              ) : onSelect ? (
                <button
                  aria-pressed={selected}
                  className={styles.cardAction}
                  onClick={() => onSelect(asset)}
                  type="button"
                >
                  <MediaCardContent asset={asset} />
                </button>
              ) : (
                <article className={styles.cardStatic}>
                  <MediaCardContent asset={asset} />
                </article>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
