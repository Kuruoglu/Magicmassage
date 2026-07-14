"use client";

import { useId, useMemo, useState } from "react";

import type { MediaRecord } from "@/admin/domain";

import styles from "./MediaComponents.module.css";
import { MediaThumbnail } from "./MediaThumbnail";

export type MediaPickerProps = {
  assets: readonly MediaRecord[];
  emptyMessage?: string;
  filterAsset?: (asset: MediaRecord) => boolean;
  getDisabledReason?: (asset: MediaRecord) => string | undefined;
  isAssetDisabled?: (asset: MediaRecord) => boolean;
  label?: string;
  name?: string;
  onChange: (asset: MediaRecord) => void;
  searchLabel?: string;
  selectedAssetId?: string;
};

export function MediaPicker({
  assets,
  emptyMessage = "Подходящие файлы не найдены.",
  filterAsset,
  getDisabledReason,
  isAssetDisabled,
  label = "Выберите файл",
  name,
  onChange,
  searchLabel = "Поиск по медиатеке",
  selectedAssetId,
}: MediaPickerProps) {
  const instanceId = useId().replace(/:/g, "");
  const [query, setQuery] = useState("");
  const inputName = name ?? `media-picker-${instanceId}`;
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const filteredAssets = useMemo(
    () => assets
      .filter((asset) => filterAsset?.(asset) ?? true)
      .filter((asset) => {
        if (!normalizedQuery) return true;
        const searchable = [
          asset.name,
          asset.altText,
          asset.folder,
          asset.status,
          asset.type,
          ...asset.usage,
          ...(asset.placements?.map((placement) => placement.placementKey) ?? []),
        ].join(" ").toLocaleLowerCase("ru-RU");
        return searchable.includes(normalizedQuery);
      }),
    [assets, filterAsset, normalizedQuery],
  );

  return (
    <fieldset className={styles.picker}>
      <legend>{label}</legend>
      <label className={styles.searchLabel} htmlFor={`${instanceId}-search`}>
        <span>{searchLabel}</span>
        <input
          className={styles.searchInput}
          id={`${instanceId}-search`}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          value={query}
        />
      </label>
      {filteredAssets.length > 0 ? (
        <div className={styles.pickerGrid}>
          {filteredAssets.map((asset) => {
            const disabled = isAssetDisabled?.(asset) ?? false;
            const disabledReason = disabled ? getDisabledReason?.(asset) : undefined;
            const selected = selectedAssetId === asset.id;

            return (
              <label
                className={styles.pickerCard}
                data-disabled={disabled ? "true" : "false"}
                data-selected={selected ? "true" : "false"}
                key={asset.id}
                title={disabledReason}
              >
                <input
                  checked={selected}
                  disabled={disabled}
                  name={inputName}
                  onChange={() => onChange(asset)}
                  type="radio"
                  value={asset.id}
                />
                <MediaThumbnail asset={asset} sizes="(max-width: 640px) 44vw, 190px" />
                <span className={styles.pickerCopy}>
                  <strong>{asset.name}</strong>
                  <span>{asset.folder} · {asset.status}</span>
                  {disabledReason ? <span>{disabledReason}</span> : null}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>{emptyMessage}</p>
      )}
    </fieldset>
  );
}
