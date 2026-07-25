import { describe, expect, it } from "vitest";

import { mediaStorageStatus } from "./media-alt-status";

describe("mediaStorageStatus", () => {
  it("marks meaningful alt text as ready", () => {
    expect(mediaStorageStatus("Lymphatic partner plus")).toBe("ready");
  });

  it("treats every JavaScript whitespace form as missing alt text", () => {
    expect(mediaStorageStatus(" \t\n\r")).toBe("needs_alt");
  });
});
