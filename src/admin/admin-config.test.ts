import { describe, expect, it } from "vitest";

import {
  accountantRoleId,
  adminModules,
  calculateFinanceSummary,
  getAdminNavigationForRole,
  resolveAdminSection,
  resolveAdminRole,
} from "./config";

describe("admin config", () => {
  it("keeps the accountant role limited to finance navigation", () => {
    const accountantNavigation = getAdminNavigationForRole(accountantRoleId);

    expect(accountantNavigation.map((item) => item.id)).toEqual(["finances"]);
    expect(accountantNavigation).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "clients" }),
        expect.objectContaining({ id: "calendar" }),
        expect.objectContaining({ id: "settings" }),
      ]),
    );
  });

  it("keeps owner navigation aligned with the approved admin modules", () => {
    const ownerNavigation = getAdminNavigationForRole("owner");

    expect(ownerNavigation.map((item) => item.id)).toEqual(adminModules.map((item) => item.id));
  });

  it("routes specialists directly to their own calendar", () => {
    expect(getAdminNavigationForRole("specialist").map((item) => item.id)).toEqual(["calendar"]);
    expect(resolveAdminSection("dashboard", "specialist")).toBe("calendar");
  });

  it("redirects accountants away from forbidden sections", () => {
    expect(resolveAdminSection("clients", accountantRoleId)).toBe("finances");
    expect(resolveAdminSection("calendar", accountantRoleId)).toBe("finances");
    expect(resolveAdminSection("finances", accountantRoleId)).toBe("finances");
  });

  it("normalizes unknown roles to a safe read-only role", () => {
    expect(resolveAdminRole("unknown")).toBe("viewer");
    expect(resolveAdminRole(undefined)).toBe("viewer");
    expect(resolveAdminRole("accountant")).toBe("accountant");
  });

  it("calculates Stripe finance totals for tax-period exports", () => {
    const summary = calculateFinanceSummary([
      { gross: 250, stripeFee: 8.6, refund: 0 },
      { gross: 180, stripeFee: 6.1, refund: 40 },
      { gross: 120, stripeFee: 4.2, refund: 0 },
    ]);

    expect(summary).toEqual({
      gross: 550,
      refunds: 40,
      stripeFees: 18.9,
      net: 491.1,
      payments: 3,
    });
  });
});
