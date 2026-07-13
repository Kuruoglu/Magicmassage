import { describe, expect, it } from "vitest";

import { formatCurrency, isPositiveInteger, statusClass } from "./formatters";

describe("admin formatters", () => {
  it("formats EUR currency for admin finance summaries", () => {
    expect(formatCurrency(1234.5)).toContain("1");
    expect(formatCurrency(1234.5)).toContain("€");
  });

  it("maps status labels to stable tone classes", () => {
    expect(statusClass("Новая заявка")).toBe("admin-status admin-status-warning");
    expect(statusClass("Скрыт")).toBe("admin-status admin-status-danger");
    expect(statusClass("Оплачено")).toBe("admin-status admin-status-success");
  });

  it("validates positive integer form values", () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(1.5)).toBe(false);
  });
});
