import { NextResponse } from "next/server";

import {
  allAdminRoles,
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";
import { setAdminAccessTokenCookies } from "@/lib/supabase/admin-session-cookie";

export async function POST(request: Request) {
  const token = getBearerToken(request.headers.get("authorization"));
  const client = createSupabaseAdminClient();

  if (!client) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authorization = await authorizeSupabaseAdminAccess(client, token, {
    allowedRoles: allAdminRoles,
  });

  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.message }, { status: authorization.statusCode });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  setAdminAccessTokenCookies(response, token!);

  return response;
}
