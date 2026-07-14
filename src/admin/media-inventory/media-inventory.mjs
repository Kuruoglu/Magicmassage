import { createHash } from "node:crypto";
import path from "node:path";

export const MEDIA_INVENTORY_SCHEMA_VERSION = 1;

export const IMAGE_MIME_TYPES = Object.freeze({
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".cur": "image/x-icon",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".icns": "image/icns",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".jxl": "image/jxl",
  ".png": "image/png",
  ".psd": "image/vnd.adobe.photoshop",
  ".svg": "image/svg+xml",
  ".tga": "image/x-tga",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
});

const RECORD_INPUT_KEYS = ["byteSize", "height", "repoPath", "width"];
const SOURCE_INPUT_KEYS = ["content", "sourcePath"];
const INVENTORY_KEYS = ["records", "schemaVersion"];
const PLACEMENT_KEYS = ["line", "placement", "sourcePath"];
const PLACEMENT_TYPES = new Set(["component", "content", "route", "script", "seo", "source", "style"]);
const RECORD_KEYS = [
  "alt",
  "byteSize",
  "consent",
  "extension",
  "fileName",
  "folder",
  "height",
  "id",
  "inferredType",
  "mimeType",
  "placements",
  "repoPath",
  "tags",
  "url",
  "width",
];

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError(`${label} contains unexpected or missing keys.`);
  }
}

function assertNullableDimension(value, label) {
  if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) {
    throw new TypeError(`${label} must be a positive integer or null.`);
  }
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function comparePlacements(left, right) {
  const sourceComparison = compareText(left.sourcePath, right.sourcePath);
  if (sourceComparison !== 0) return sourceComparison;
  if (left.line !== right.line) return left.line - right.line;
  return compareText(left.placement, right.placement);
}

export function normalizeRepoPath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("repoPath must be a non-empty string.");
  }

  const normalized = value.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").includes("..")
  ) {
    throw new TypeError("repoPath must be relative and cannot contain parent traversal.");
  }

  const compact = path.posix.normalize(normalized).replace(/^\.\//, "");
  if (!compact.startsWith("public/") || compact === "public/") {
    throw new TypeError("repoPath must identify a file inside public/.");
  }

  return compact;
}

export function isSupportedImagePath(value) {
  if (typeof value !== "string") {
    return false;
  }

  return Object.hasOwn(IMAGE_MIME_TYPES, path.posix.extname(value).toLowerCase());
}

export function stableMediaId(repoPath) {
  const normalized = normalizeRepoPath(repoPath);
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 20);
  return `media_${digest}`;
}

function inferType(publicRelativePath) {
  const tokens = publicRelativePath.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokenSet = new Set(tokens);

  if (tokenSet.has("logo")) return "logo";
  if (tokenSet.has("gift") && (tokenSet.has("certificate") || tokenSet.has("certificates"))) {
    return "gift-certificate";
  }
  if (tokenSet.has("certificate") || tokenSet.has("certificates")) return "certificate";
  if (tokenSet.has("hero")) return "hero";
  if (tokenSet.has("service") || tokenSet.has("services")) return "service";
  if (tokenSet.has("gallery")) return "gallery";
  if (tokenSet.has("portrait")) return "portrait";
  if (tokenSet.has("about")) return "about";
  return "image";
}

function inferTags(publicRelativePath, inferredType) {
  const withoutExtension = publicRelativePath.slice(0, -path.posix.extname(publicRelativePath).length);
  const tokens = withoutExtension.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const usefulTokens = tokens.filter((token) => token !== "media" && !/^\d+$/.test(token));
  return [...new Set([inferredType, ...usefulTokens])].sort();
}

function inferAltText(publicRelativePath, inferredType) {
  const fileStem = path.posix.basename(publicRelativePath, path.posix.extname(publicRelativePath));
  const words = fileStem
    .split(/[-_]+/)
    .map((word) => word.trim())
    .filter((word) => word && !/^\d+$/.test(word));

  if (inferredType === "logo") return "Magic Massage Natali logo";
  if (words.length === 0) return `Magic Massage Natali ${inferredType}`;

  const label = words.join(" ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function toPublicUrl(publicRelativePath) {
  return `/${publicRelativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function createMediaRecord(input) {
  assertPlainObject(input, "Media record input");
  assertExactKeys(input, RECORD_INPUT_KEYS, "Media record input");

  const repoPath = normalizeRepoPath(input.repoPath);
  const extension = path.posix.extname(repoPath).toLowerCase();
  if (!isSupportedImagePath(repoPath)) {
    throw new TypeError(`Unsupported public image extension: ${extension || "none"}.`);
  }
  if (!Number.isSafeInteger(input.byteSize) || input.byteSize < 0) {
    throw new TypeError("byteSize must be a non-negative safe integer.");
  }
  assertNullableDimension(input.width, "width");
  assertNullableDimension(input.height, "height");

  const publicRelativePath = repoPath.slice("public/".length);
  const inferredType = inferType(publicRelativePath);
  const folder = path.posix.dirname(publicRelativePath);

  return {
    id: stableMediaId(repoPath),
    url: toPublicUrl(publicRelativePath),
    repoPath,
    fileName: path.posix.basename(repoPath),
    extension,
    mimeType: IMAGE_MIME_TYPES[extension],
    byteSize: input.byteSize,
    width: input.width,
    height: input.height,
    folder: folder === "." ? "/" : folder,
    inferredType,
    tags: inferTags(publicRelativePath, inferredType),
    alt: inferAltText(publicRelativePath, inferredType),
    consent: "not_required",
    placements: [],
  };
}

function normalizeSourcePath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  const normalized = value.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized) || normalized.split("/").includes("..")) {
    throw new TypeError(`${label} must be repository-relative.`);
  }
  return path.posix.normalize(normalized).replace(/^\.\//, "");
}

function normalizeSourceFile(input, index) {
  assertPlainObject(input, `Source file ${index}`);
  assertExactKeys(input, SOURCE_INPUT_KEYS, `Source file ${index}`);
  if (typeof input.content !== "string") {
    throw new TypeError(`Source file ${index} content must be a string.`);
  }

  const sourcePath = normalizeSourcePath(input.sourcePath, `Source file ${index} sourcePath`);
  return { sourcePath, content: input.content };
}

function inferPlacement(sourcePath) {
  if (sourcePath.startsWith("src/seo/")) return "seo";
  if (sourcePath.startsWith("src/content/")) return "content";
  if (sourcePath.startsWith("src/components/")) return "component";
  if (sourcePath.startsWith("src/app/")) return "route";
  if (/\.(css|scss|sass|less)$/.test(sourcePath)) return "style";
  if (sourcePath.startsWith("scripts/")) return "script";
  return "source";
}

export function inferUsagePlacements(record, sourceFiles) {
  if (!record || typeof record.url !== "string" || typeof record.repoPath !== "string") {
    throw new TypeError("record must contain url and repoPath strings.");
  }
  if (!Array.isArray(sourceFiles)) {
    throw new TypeError("sourceFiles must be an array.");
  }

  const publicRelativePath = record.repoPath.slice("public/".length);
  const references = [record.url, record.repoPath, publicRelativePath];
  const placements = [];
  const normalizedSources = sourceFiles
    .map(normalizeSourceFile)
    .sort((left, right) => compareText(left.sourcePath, right.sourcePath));

  for (const source of normalizedSources) {
    const lines = source.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (references.some((reference) => lines[index].includes(reference))) {
        placements.push({
          sourcePath: source.sourcePath,
          line: index + 1,
          placement: inferPlacement(source.sourcePath),
        });
      }
    }
  }

  return placements;
}

export function buildMediaInventory(fileInputs, sourceFiles = []) {
  if (!Array.isArray(fileInputs)) {
    throw new TypeError("fileInputs must be an array.");
  }
  if (!Array.isArray(sourceFiles)) {
    throw new TypeError("sourceFiles must be an array.");
  }

  const records = fileInputs
    .map(createMediaRecord)
    .sort((left, right) => compareText(left.repoPath, right.repoPath));
  const seenPaths = new Set();
  for (const record of records) {
    if (seenPaths.has(record.repoPath)) {
      throw new TypeError(`Duplicate media path: ${record.repoPath}.`);
    }
    seenPaths.add(record.repoPath);
    record.placements = inferUsagePlacements(record, sourceFiles);
  }

  return { schemaVersion: MEDIA_INVENTORY_SCHEMA_VERSION, records };
}

function validateInventory(inventory) {
  assertPlainObject(inventory, "Media inventory");
  assertExactKeys(inventory, INVENTORY_KEYS, "Media inventory");
  if (inventory.schemaVersion !== MEDIA_INVENTORY_SCHEMA_VERSION) {
    throw new TypeError("Media inventory schemaVersion is not supported.");
  }
  if (!Array.isArray(inventory.records)) {
    throw new TypeError("Media inventory records must be an array.");
  }

  let previousRepoPath = null;
  const seenIds = new Set();
  for (const [index, record] of inventory.records.entries()) {
    assertPlainObject(record, `Media inventory record ${index}`);
    assertExactKeys(record, RECORD_KEYS, `Media inventory record ${index}`);

    const expected = createMediaRecord({
      repoPath: record.repoPath,
      byteSize: record.byteSize,
      width: record.width,
      height: record.height,
    });
    const derivedKeys = [
      "alt",
      "consent",
      "extension",
      "fileName",
      "folder",
      "id",
      "inferredType",
      "mimeType",
      "repoPath",
      "url",
    ];
    if (derivedKeys.some((key) => record[key] !== expected[key])) {
      throw new TypeError(`Media inventory record ${index} contains invalid derived metadata.`);
    }
    if (JSON.stringify(record.tags) !== JSON.stringify(expected.tags)) {
      throw new TypeError(`Media inventory record ${index} contains invalid inferred tags.`);
    }
    if (!Array.isArray(record.placements)) {
      throw new TypeError(`Media inventory record ${index} placements must be an array.`);
    }

    let previousPlacement = null;
    for (const [placementIndex, placement] of record.placements.entries()) {
      const label = `Media inventory record ${index} placement ${placementIndex}`;
      assertPlainObject(placement, label);
      assertExactKeys(placement, PLACEMENT_KEYS, label);
      const sourcePath = normalizeSourcePath(placement.sourcePath, `${label} sourcePath`);
      if (sourcePath !== placement.sourcePath) {
        throw new TypeError(`${label} sourcePath must be normalized.`);
      }
      if (!Number.isSafeInteger(placement.line) || placement.line <= 0) {
        throw new TypeError(`${label} line must be a positive integer.`);
      }
      if (!PLACEMENT_TYPES.has(placement.placement)) {
        throw new TypeError(`${label} has an unsupported placement type.`);
      }
      if (previousPlacement !== null && comparePlacements(previousPlacement, placement) >= 0) {
        throw new TypeError(`Media inventory record ${index} placements must be unique and sorted.`);
      }
      previousPlacement = placement;
    }

    if (previousRepoPath !== null && compareText(previousRepoPath, record.repoPath) >= 0) {
      throw new TypeError("Media inventory records must have unique, sorted repoPath values.");
    }
    if (seenIds.has(record.id)) {
      throw new TypeError(`Media inventory record ${index} has a duplicate id.`);
    }
    previousRepoPath = record.repoPath;
    seenIds.add(record.id);
  }
}

export function serializeMediaInventory(inventory) {
  validateInventory(inventory);
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

export function inventoryMatches(existingContent, inventory) {
  if (typeof existingContent !== "string") {
    return false;
  }
  return existingContent === serializeMediaInventory(inventory);
}
