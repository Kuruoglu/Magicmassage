import { NextResponse } from "next/server";

import {
  adminAccessTokenCookieName,
  allAdminRoles,
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

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

  response.cookies.set(adminAccessTokenCookieName, token ?? "", {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.append(
    "Set-Cookie",
    `${adminAccessTokenCookieName}=${encodeURIComponent(token ?? "")}; Path=/api/media/admin; Max-Age=3600; HttpOnly; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );

  return response;
}
