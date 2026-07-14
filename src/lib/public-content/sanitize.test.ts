import { describe, expect, it } from "vitest";

import { sanitizePublicBlogHtml } from "./sanitize";

describe("sanitizePublicBlogHtml", () => {
  it("keeps basic editorial markup and removes executable content", () => {
    const result = sanitizePublicBlogHtml(
      '<h2>Title</h2><p onclick="run()">Text <strong>strong</strong></p>' +
        '<iframe src="https://example.com"></iframe><img src="data:image/png;base64,bad" onerror="run()">',
    );

    expect(result).toBe("<h2>Title</h2><p>Text <strong>strong</strong></p>");
  });
});
