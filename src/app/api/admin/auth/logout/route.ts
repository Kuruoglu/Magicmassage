import { NextResponse } from "next/server";

import { adminAccessTokenCookieName } from "@/lib/supabase/admin";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(adminAccessTokenCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
