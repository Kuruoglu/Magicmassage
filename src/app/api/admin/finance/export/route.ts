import { NextResponse } from "next/server";

import {
  buildFinanceCsv,
  buildFinanceExportFilename,
  parseFinanceExportPayload,
  summarizeFinanceRows,
} from "@/admin/finance-export";
import { createAdminSupabaseRepository } from "@/admin/repository";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid finance export payload." }, { status: 400 });
  }

  const exportPayload = parseFinanceExportPayload(payload);

  if (!exportPayload) {
    return NextResponse.json({ error: "Invalid finance export payload." }, { status: 400 });
  }

  const client = createSupabaseAdminClient();

  if (!client) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator", "accountant"] },
  );

  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.message }, { status: authorization.statusCode });
  }

  const repository = createAdminSupabaseRepository(client);
  const rows = await repository.listStripeSales({
    from: exportPayload.periodStart,
    to: exportPayload.periodEnd,
  });
  const summary = summarizeFinanceRows(rows);

  await repository.logFinanceExport({
    downloadedBy: authorization.userId,
    exportFormat: exportPayload.format,
    periodEnd: exportPayload.periodEnd,
    periodStart: exportPayload.periodStart,
    summary,
  });

  const csv = buildFinanceCsv(rows);
  const filename = buildFinanceExportFilename(exportPayload);

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
