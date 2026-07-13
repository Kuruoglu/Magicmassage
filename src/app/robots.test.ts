import { describe, expect, it } from "vitest";

import robots from "./robots";

describe("robots", () => {
  it("keeps public pages crawlable and blocks admin", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: "/admin",
      },
      sitemap: "https://magicmassagenatali.bg/sitemap.xml",
    });
  });
});
