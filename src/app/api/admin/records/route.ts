import { NextResponse } from "next/server";

import { isAdminPersistInput, persistAdminRecord } from "@/admin/persistence";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
  resolveSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { resolveAdminSupabaseEnv } from "@/admin/supabase-client";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid admin record payload." }, { status: 400 });
  }

  if (!isAdminPersistInput(payload)) {
    return NextResponse.json({ error: "Invalid admin record payload." }, { status: 400 });
  }

  const supabaseAdminClient = createSupabaseAdminClient();

  if (supabaseAdminClient) {
    const authorization = await authorizeSupabaseAdminAccess(
      supabaseAdminClient,
      getBearerToken(request.headers.get("authorization")),
      { allowedRoles: ["owner", "administrator"] },
    );

    if (!authorization.ok) {
      return NextResponse.json(authorization, { status: authorization.statusCode });
    }
  } else if (resolveAdminSupabaseEnv() && !resolveSupabaseAdminEnv()) {
    return NextResponse.json(
      {
        message: "SUPABASE_SECRET_KEY is required before writing admin records to Supabase.",
        mode: "supabase",
        ok: false,
      },
      { status: 500 },
    );
  }

  const result = await persistAdminRecord(payload);
  const status = result.ok || result.mode === "demo" ? 200 : 500;

  return NextResponse.json(result, { status });
}
