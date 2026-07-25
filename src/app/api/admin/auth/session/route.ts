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

  const { error: loginAuditError } = await client.rpc("admin_mark_login", {
    p_actor_user_id: authorization.userId,
  });
  if (loginAuditError) {
    console.error("Admin login audit failed", loginAuditError.message);
    return NextResponse.json({ error: "Unable to establish an audited admin session" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, role: authorization.role });
  setAdminAccessTokenCookies(response, token!);

  return response;
}
