import { describe, expect, it } from "vitest";

import { normalizeMediaStatus } from "./media-status";

describe("media status", () => {
  it("marks media with alt text as ready instead of requiring alt", () => {
    expect(normalizeMediaStatus("Требует alt", "Lymphatic partner plus")).toBe("Готово");
  });

  it("marks non-draft media without alt text as requiring alt", () => {
    expect(normalizeMediaStatus("Готово", "   ")).toBe("Требует alt");
  });

  it("preserves an explicit draft regardless of alt text", () => {
    expect(normalizeMediaStatus("Черновик", "Lymphatic partner plus")).toBe("Черновик");
    expect(normalizeMediaStatus("Черновик", "")).toBe("Черновик");
  });
});
