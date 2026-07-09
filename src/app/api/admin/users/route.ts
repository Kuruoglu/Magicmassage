import { NextResponse } from "next/server";

import { isAdminUserActionInput, runAdminUserAction } from "@/admin/admin-user-actions";

function getBearerToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim();
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid admin user payload." }, { status: 400 });
  }

  if (!isAdminUserActionInput(payload)) {
    return NextResponse.json({ error: "Invalid admin user payload." }, { status: 400 });
  }

  const result = await runAdminUserAction(payload, {
    actorToken: getBearerToken(request.headers.get("authorization")),
  });
  const status = result.ok || result.mode === "demo" ? 200 : (result.statusCode ?? 500);

  return NextResponse.json(result, { status });
}
