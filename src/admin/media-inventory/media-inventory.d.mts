export type MediaPlacement = "component" | "content" | "route" | "script" | "seo" | "source" | "style";

export interface MediaUsagePlacement {
  sourcePath: string;
  line: number;
  placement: MediaPlacement;
}

export interface MediaInventoryRecord {
  id: string;
  url: string;
  repoPath: string;
  fileName: string;
  extension: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  folder: string;
  inferredType: string;
  tags: string[];
  alt: "";
  consent: "";
  placements: MediaUsagePlacement[];
}

export interface MediaInventory {
  schemaVersion: 1;
  records: MediaInventoryRecord[];
}

export interface MediaFileInput {
  repoPath: string;
  byteSize: number;
  width: number | null;
  height: number | null;
}

export interface MediaSourceFile {
  sourcePath: string;
  content: string;
}

export const MEDIA_INVENTORY_SCHEMA_VERSION: 1;
export const IMAGE_MIME_TYPES: Readonly<Record<string, string>>;

export function normalizeRepoPath(value: string): string;
export function isSupportedImagePath(value: unknown): boolean;
export function stableMediaId(repoPath: string): string;
export function createMediaRecord(input: MediaFileInput): MediaInventoryRecord;
export function inferUsagePlacements(
  record: Pick<MediaInventoryRecord, "repoPath" | "url">,
  sourceFiles: MediaSourceFile[],
): MediaUsagePlacement[];
export function buildMediaInventory(
  fileInputs: MediaFileInput[],
  sourceFiles?: MediaSourceFile[],
): MediaInventory;
export function serializeMediaInventory(inventory: MediaInventory): string;
export function inventoryMatches(existingContent: unknown, inventory: MediaInventory): boolean;
