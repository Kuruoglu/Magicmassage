import { describe, expect, it } from "vitest";

import { isValidEmail, matchesSearch, parseClientTags, parseCommaList } from "./filters";

describe("admin filter helpers", () => {
  it("matches normalized search values", () => {
    expect(matchesSearch(["Anna Petrova", "+359 89"], "anna")).toBe(true);
    expect(matchesSearch(["Anna Petrova"], "missing")).toBe(false);
    expect(matchesSearch(["Anna Petrova"], "")).toBe(true);
  });

  it("validates basic email input", () => {
    expect(isValidEmail("client@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
  });

  it("parses comma-separated lists without empty entries", () => {
    expect(parseClientTags("RU, regular, ")).toEqual(["RU", "regular"]);
    expect(parseCommaList("a, b,, c")).toEqual(["a", "b", "c"]);
  });
});
