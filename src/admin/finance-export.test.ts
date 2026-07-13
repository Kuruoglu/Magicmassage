import { describe, expect, it } from "vitest";

import { buildFinanceCsv, parseFinanceExportPayload, summarizeFinanceRows } from "./finance-export";

describe("admin finance export helpers", () => {
  it("validates export payload shape and rejects unexpected keys", () => {
    expect(parseFinanceExportPayload({ format: "csv", periodEnd: "2026-07-31", periodStart: "2026-07-01" })).toEqual({
      format: "csv",
      periodEnd: "2026-07-31",
      periodStart: "2026-07-01",
    });
    expect(parseFinanceExportPayload({ format: "pdf", periodEnd: "2026-07-31", periodStart: "2026-07-01" })).toBeUndefined();
    expect(parseFinanceExportPayload({ extra: true, format: "csv", periodEnd: "2026-07-31", periodStart: "2026-07-01" })).toBeUndefined();
    expect(parseFinanceExportPayload({ format: "csv", periodEnd: "2026-07-01", periodStart: "2026-07-31" })).toBeUndefined();
  });

  it("builds quoted CSV and finance summary", () => {
    const rows = [
      {
        buyer: 'Anna "Tax"',
        certificateCode: "MMN-TAX-1",
        date: "2026-07-03",
        gross: 250,
        id: "pi_tax_1",
        refund: 0,
        stripeFee: 8.6,
      },
    ];

    expect(buildFinanceCsv(rows)).toContain('"Anna ""Tax"""');
    expect(summarizeFinanceRows(rows)).toMatchObject({
      gross: 250,
      net: 241.4,
      payments: 1,
    });
  });
});
