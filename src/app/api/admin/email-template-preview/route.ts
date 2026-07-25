import { NextResponse } from "next/server";

import { renderEmailTemplatePreview } from "@/email/template-preview";
import {
  emailLocales,
  transactionalEmailEvents,
  type EmailLocale,
  type TransactionalEmailEvent,
} from "@/email/types";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return jsonError("Forbidden", 403);

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator"] },
  );
  if (!authorization.ok) return jsonError(authorization.message, authorization.statusCode);

  const url = new URL(request.url);
  const eventType = url.searchParams.get("eventType") ?? "";
  const locale = url.searchParams.get("locale") ?? "";
  if (
    !transactionalEmailEvents.includes(eventType as TransactionalEmailEvent)
    || !emailLocales.includes(locale as EmailLocale)
  ) {
    return jsonError("Неверный тип письма или язык.", 400);
  }

  return NextResponse.json({
    preview: renderEmailTemplatePreview(
      eventType as TransactionalEmailEvent,
      locale as EmailLocale,
    ),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
