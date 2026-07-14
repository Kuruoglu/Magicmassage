#!/usr/bin/env node

import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { imageSize } from "image-size";

import {
  buildMediaInventory,
  inventoryMatches,
  isSupportedImagePath,
  serializeMediaInventory,
} from "../../src/admin/media-inventory/media-inventory.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const PUBLIC_ROOT = path.join(REPO_ROOT, "public");
const OUTPUT_PATH = path.join(REPO_ROOT, "src", "admin", "media-inventory", "media-inventory.json");
const SOURCE_ROOTS = ["src", "app", "pages", "components", "lib", "styles", "scripts"];
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".jsx",
  ".less",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".sass",
  ".scss",
  ".ts",
  ".tsx",
]);

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function toRepoPath(absolutePath) {
  const relativePath = path.relative(REPO_ROOT, absolutePath);
  if (relativePath === "" || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error("A scanned path escaped the repository root.");
  }
  return relativePath.split(path.sep).join("/");
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function shouldScanSource(repoPath) {
  if (repoPath.startsWith("src/admin/media-inventory/")) return false;
  if (/(^|\/)(__tests__|test|tests)(\/|$)/.test(repoPath)) return false;
  if (/\.(test|spec)\.[^.]+$/.test(repoPath)) return false;
  return SOURCE_EXTENSIONS.has(path.posix.extname(repoPath).toLowerCase());
}

async function collectSourceFiles() {
  const sourceFiles = [];

  for (const rootName of SOURCE_ROOTS) {
    const rootPath = path.join(REPO_ROOT, rootName);
    try {
      if (!(await stat(rootPath)).isDirectory()) continue;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") continue;
      throw error;
    }

    for (const absolutePath of await collectFiles(rootPath)) {
      const sourcePath = toRepoPath(absolutePath);
      if (!shouldScanSource(sourcePath)) continue;
      sourceFiles.push({ sourcePath, content: await readFile(absolutePath, "utf8") });
    }
  }

  return sourceFiles.sort((left, right) => compareText(left.sourcePath, right.sourcePath));
}

function readDimensions(buffer, repoPath, warnings) {
  try {
    const dimensions = imageSize(buffer);
    const width = Number.isSafeInteger(dimensions.width) && dimensions.width > 0 ? dimensions.width : null;
    const height = Number.isSafeInteger(dimensions.height) && dimensions.height > 0 ? dimensions.height : null;
    if (width === null || height === null) {
      warnings.push(`Dimensions unavailable for ${repoPath}.`);
    }
    return { width, height };
  } catch {
    warnings.push(`Dimensions unavailable for ${repoPath}.`);
    return { width: null, height: null };
  }
}

async function createInventory() {
  const warnings = [];
  const publicFiles = await collectFiles(PUBLIC_ROOT);
  const imageInputs = [];

  for (const absolutePath of publicFiles) {
    const repoPath = toRepoPath(absolutePath);
    if (!isSupportedImagePath(repoPath)) continue;
    const buffer = await readFile(absolutePath);
    const dimensions = readDimensions(buffer, repoPath, warnings);
    imageInputs.push({
      repoPath,
      byteSize: buffer.byteLength,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  const sourceFiles = await collectSourceFiles();
  return { inventory: buildMediaInventory(imageInputs, sourceFiles), warnings };
}

function parseArguments(args) {
  let check = false;
  let help = false;

  for (const argument of args) {
    if (argument === "--check") check = true;
    else if (argument === "--help" || argument === "-h") help = true;
    else throw new TypeError(`Unknown argument: ${argument}`);
  }

  return { check, help };
}

async function run() {
  const { check, help } = parseArguments(process.argv.slice(2));
  if (help) {
    console.log("Usage: node scripts/media/scan-media-inventory.mjs [--check]");
    return;
  }

  const { inventory, warnings } = await createInventory();
  for (const warning of warnings) console.warn(`Warning: ${warning}`);

  if (check) {
    let existingContent;
    try {
      existingContent = await readFile(OUTPUT_PATH, "utf8");
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
    }

    if (!inventoryMatches(existingContent, inventory)) {
      console.error("Media inventory is missing or stale. Run the scanner without --check.");
      process.exitCode = 1;
      return;
    }
    console.log(`Media inventory is current (${inventory.records.length} records).`);
    return;
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, serializeMediaInventory(inventory), "utf8");
  console.log(`Wrote ${inventory.records.length} records to src/admin/media-inventory/media-inventory.json.`);
}

run().catch((error) => {
  if (error instanceof TypeError && error.message.startsWith("Unknown argument:")) {
    console.error(`${error.message} Use --help for usage.`);
    process.exitCode = 2;
    return;
  }
  console.error("Media inventory scan failed. Check repository file permissions and image validity.");
  process.exitCode = 1;
});
