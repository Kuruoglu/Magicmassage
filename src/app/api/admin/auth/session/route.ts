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

  const response = NextResponse.json({ ok: true, role: authorization.role });

  response.cookies.set(adminAccessTokenCookieName, token ?? "", {
    httpOnly: true,
    maxAge: 60 * 60,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
