import Image from "next/image";

import type { MediaRecord } from "@/admin/domain";

import styles from "./MediaComponents.module.css";

type MediaThumbnailProps = {
  asset: MediaRecord;
  className?: string;
  sizes: string;
};

export function MediaThumbnail({ asset, className = styles.thumbnail, sizes }: MediaThumbnailProps) {
  return (
    <div className={className}>
      {asset.type === "Фото" ? (
        <Image alt={asset.altText || ""} fill sizes={sizes} src={asset.url} unoptimized />
      ) : (
        <span className={styles.documentMark}>Документ</span>
      )}
    </div>
  );
}
