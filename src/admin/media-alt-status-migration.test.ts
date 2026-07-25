import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("media alt status integrity migration", () => {
  it("repairs stale statuses and prevents alt/status contradictions", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260718110000_media_alt_status_integrity.sql"),
      "utf8",
    );

    expect(sql).toContain("when alt_text ~ '[^[:space:]]' then 'ready'");
    expect(sql).toContain("else 'needs_alt'");
    expect(sql).toContain("admin_media_assets_alt_status_check");
    expect(sql).toContain("status = 'draft'");
    expect(sql).toContain("status = 'ready' and alt_text ~ '[^[:space:]]'");
    expect(sql).toContain("status = 'needs_alt' and not (alt_text ~ '[^[:space:]]')");
  });
});
