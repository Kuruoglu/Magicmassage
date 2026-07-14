import { NextResponse } from "next/server";

import { adminAccessTokenCookieName } from "@/lib/supabase/admin";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const secureAttribute = process.env.NODE_ENV === "production" ? "; Secure" : "";

  response.cookies.set(adminAccessTokenCookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/admin",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.append(
    "Set-Cookie",
    `${adminAccessTokenCookieName}=; Path=/api/media/admin; Max-Age=0; Expires=${new Date(0).toUTCString()}; HttpOnly; SameSite=Lax${secureAttribute}`,
  );

  return response;
}
