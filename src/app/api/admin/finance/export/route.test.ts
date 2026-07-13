// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const financeExportRouteMock = vi.hoisted(() => ({
  authorization: {
    mode: "supabase",
    ok: true,
    role: "accountant",
    userId: "11111111-1111-4111-8111-111111111111",
  } as unknown,
  client: { from: vi.fn() },
  listStripeSales: vi.fn(),
  logFinanceExport: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin")>();

  return {
    ...actual,
    authorizeSupabaseAdminAccess: vi.fn(async () => financeExportRouteMock.authorization),
    createSupabaseAdminClient: vi.fn(() => financeExportRouteMock.client),
  };
});

vi.mock("@/admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/admin/repository")>();

  return {
    ...actual,
    createAdminSupabaseRepository: vi.fn(() => ({
      listStripeSales: financeExportRouteMock.listStripeSales,
      logFinanceExport: financeExportRouteMock.logFinanceExport,
    })),
  };
});

describe("admin finance export API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    financeExportRouteMock.authorization = {
      mode: "supabase",
      ok: true,
      role: "accountant",
      userId: "11111111-1111-4111-8111-111111111111",
    };
    financeExportRouteMock.listStripeSales.mockResolvedValue([
      {
        buyer: "Tax Buyer",
        certificateCode: "MMN-TAX-1",
        date: "2026-07-03",
        gross: 250,
        id: "pi_tax_1",
        refund: 0,
        stripeFee: 8.6,
      },
    ]);
  });

  it("returns CSV and logs accountant exports", async () => {
    const response = await POST(
      new Request("https://example.com/api/admin/finance/export", {
        body: JSON.stringify({
          format: "csv",
          periodEnd: "2026-07-31",
          periodStart: "2026-07-01",
        }),
        headers: {
          authorization: "Bearer accountant-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    await expect(response.text()).resolves.toContain('"pi_tax_1"');
    expect(financeExportRouteMock.listStripeSales).toHaveBeenCalledWith({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(financeExportRouteMock.logFinanceExport).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadedBy: "11111111-1111-4111-8111-111111111111",
        exportFormat: "csv",
        periodEnd: "2026-07-31",
        periodStart: "2026-07-01",
      }),
    );
  });

  it("does not allow viewers to export finance", async () => {
    financeExportRouteMock.authorization = {
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    };

    const response = await POST(
      new Request("https://example.com/api/admin/finance/export", {
        body: JSON.stringify({
          format: "csv",
          periodEnd: "2026-07-31",
          periodStart: "2026-07-01",
        }),
        headers: {
          authorization: "Bearer viewer-token",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(financeExportRouteMock.listStripeSales).not.toHaveBeenCalled();
    expect(financeExportRouteMock.logFinanceExport).not.toHaveBeenCalled();
  });
});
