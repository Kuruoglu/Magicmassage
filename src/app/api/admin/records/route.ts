import { NextResponse } from "next/server";

import { isAdminPersistInput, persistAdminRecord } from "@/admin/persistence";

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

  const result = await persistAdminRecord(payload);
  const status = result.ok || result.mode === "demo" ? 200 : 500;

  return NextResponse.json(result, { status });
}
