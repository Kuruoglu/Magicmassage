import { calculateFinanceSummary, type FinanceRow } from "./config";

export type FinanceExportFormat = "csv";

export type FinanceExportPayload = {
  format: FinanceExportFormat;
  periodEnd: string;
  periodStart: string;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: string | number | undefined) {
  const stringValue = String(value ?? "");

  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function parseFinanceExportPayload(payload: unknown): FinanceExportPayload | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);

  if (!keys.every((key) => key === "format" || key === "periodStart" || key === "periodEnd")) {
    return undefined;
  }

  if (
    record.format !== "csv" ||
    typeof record.periodStart !== "string" ||
    typeof record.periodEnd !== "string" ||
    !isoDatePattern.test(record.periodStart) ||
    !isoDatePattern.test(record.periodEnd) ||
    record.periodStart > record.periodEnd
  ) {
    return undefined;
  }

  return {
    format: record.format,
    periodEnd: record.periodEnd,
    periodStart: record.periodStart,
  };
}

export function buildFinanceCsv(rows: FinanceRow[]) {
  const header = ["Date", "Payment", "Certificate", "Buyer", "Gross EUR", "Stripe fee EUR", "Refund EUR", "Net EUR", "Status"];
  const body = rows.map((row) => [
    row.date,
    row.id,
    row.certificateCode,
    row.buyer,
    row.gross.toFixed(2),
    row.stripeFee.toFixed(2),
    row.refund.toFixed(2),
    (row.gross - row.refund - row.stripeFee).toFixed(2),
    row.status,
  ]);

  return [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

export function buildFinanceExportFilename(payload: FinanceExportPayload) {
  return `magic-massage-stripe-sales-${payload.periodStart}-${payload.periodEnd}.${payload.format}`;
}

export function summarizeFinanceRows(rows: FinanceRow[]) {
  return calculateFinanceSummary(rows);
}
