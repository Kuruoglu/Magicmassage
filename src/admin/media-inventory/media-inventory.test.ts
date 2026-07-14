import { describe, expect, it } from "vitest";

import {
  buildMediaInventory,
  createMediaRecord,
  inventoryMatches,
  serializeMediaInventory,
  stableMediaId,
} from "./media-inventory.mjs";

describe("media inventory", () => {
  it("creates stable, typed records with inferred accessibility and consent metadata", () => {
    const record = createMediaRecord({
      repoPath: "public\\media\\services\\deep-tissue-massage.JPG",
      byteSize: 1234,
      width: 1600,
      height: 900,
    });

    expect(record).toMatchObject({
      id: stableMediaId("public/media/services/deep-tissue-massage.JPG"),
      url: "/media/services/deep-tissue-massage.JPG",
      repoPath: "public/media/services/deep-tissue-massage.JPG",
      fileName: "deep-tissue-massage.JPG",
      extension: ".jpg",
      mimeType: "image/jpeg",
      byteSize: 1234,
      width: 1600,
      height: 900,
      folder: "media/services",
      inferredType: "service",
      alt: "Deep tissue massage",
      consent: "not_required",
      placements: [],
    });
    expect(record.tags).toEqual(["deep", "massage", "service", "services", "tissue"]);
  });

  it("sorts records and infers deterministic source placements", () => {
    const inventory = buildMediaInventory(
      [
        {
          repoPath: "public/media/z-last.webp",
          byteSize: 2,
          width: null,
          height: null,
        },
        {
          repoPath: "public/media/hero/home.jpg",
          byteSize: 1,
          width: 1200,
          height: 800,
        },
      ],
      [
        {
          sourcePath: "src/seo/metadata.ts",
          content: "const image = `${origin}/media/hero/home.jpg`;",
        },
        {
          sourcePath: "src/components/home.tsx",
          content: "const ignored = true;\nconst src = '/media/hero/home.jpg';",
        },
      ],
    );

    expect(inventory.records.map((record) => record.repoPath)).toEqual([
      "public/media/hero/home.jpg",
      "public/media/z-last.webp",
    ]);
    expect(inventory.records[0].placements).toEqual([
      { sourcePath: "src/components/home.tsx", line: 2, placement: "component" },
      { sourcePath: "src/seo/metadata.ts", line: 1, placement: "seo" },
    ]);
    expect(inventory.records[1].placements).toEqual([]);
  });

  it("rejects traversal, unsupported formats, unknown fields, and duplicate paths", () => {
    expect(() =>
      createMediaRecord({ repoPath: "../public/image.jpg", byteSize: 1, width: 1, height: 1 }),
    ).toThrow("relative");
    expect(() =>
      createMediaRecord({ repoPath: "public/image.txt", byteSize: 1, width: 1, height: 1 }),
    ).toThrow("Unsupported");
    expect(() =>
      createMediaRecord({
        repoPath: "public/image.jpg",
        byteSize: 1,
        width: 1,
        height: 1,
        extra: true,
      } as never),
    ).toThrow("unexpected or missing keys");
    expect(() =>
      buildMediaInventory([
        { repoPath: "public/image.jpg", byteSize: 1, width: 1, height: 1 },
        { repoPath: "public/image.jpg", byteSize: 1, width: 1, height: 1 },
      ]),
    ).toThrow("Duplicate media path");
  });

  it("serializes byte-for-byte deterministically for check mode", () => {
    const inventory = buildMediaInventory([
      { repoPath: "public/media/logo.png", byteSize: 42, width: 10, height: 20 },
    ]);
    const serialized = serializeMediaInventory(inventory);

    expect(serialized.endsWith("\n")).toBe(true);
    expect(inventoryMatches(serialized, inventory)).toBe(true);
    expect(inventoryMatches(serialized.replace("42", "43"), inventory)).toBe(false);
    expect(inventoryMatches(undefined, inventory)).toBe(false);
  });

  it("rejects tampered derived metadata and invalid placements before serialization", () => {
    const inventory = buildMediaInventory([
      { repoPath: "public/media/logo.png", byteSize: 42, width: 10, height: 20 },
    ]);

    expect(() =>
      serializeMediaInventory({
        ...inventory,
        records: [{ ...inventory.records[0], mimeType: "text/plain" }],
      }),
    ).toThrow("invalid derived metadata");
    expect(() =>
      serializeMediaInventory({
        ...inventory,
        records: [
          {
            ...inventory.records[0],
            placements: [{ sourcePath: "C:/secret/file.ts", line: 1, placement: "source" }],
          },
        ],
      }),
    ).toThrow("repository-relative");
  });
});
