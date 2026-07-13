import { NextResponse } from "next/server";

import { isAdminPersistInput, persistAdminRecord } from "@/admin/persistence";
import type { AdminPersistInput } from "@/admin/persistence";
import type { AdminRoleId } from "@/admin/config";
import { isAdminDemoFallbackAllowed } from "@/admin/data-source";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
  resolveSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { resolveAdminSupabaseEnv } from "@/admin/supabase-client";

const recordWriteRoles: Record<AdminPersistInput["type"], AdminRoleId[]> = {
  appointment: ["owner", "administrator", "specialist"],
  blogPost: ["owner", "administrator", "editor"],
  certificate: ["owner", "administrator", "specialist"],
  client: ["owner", "administrator", "specialist"],
  contactChannel: ["owner", "administrator", "editor"],
  contactSettings: ["owner", "administrator", "editor"],
  media: ["owner", "administrator", "editor"],
  price: ["owner", "administrator", "editor"],
  service: ["owner", "administrator", "editor"],
  settings: ["owner", "administrator"],
};

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
      { allowedRoles: recordWriteRoles[payload.type] },
    );

    if (!authorization.ok) {
      return NextResponse.json({ error: authorization.message }, { status: authorization.statusCode });
    }
  } else if (!isAdminDemoFallbackAllowed()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
