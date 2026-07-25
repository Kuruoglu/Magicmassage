import "server-only";

import type { NextResponse } from "next/server";

import { adminAccessTokenCookieName } from "@/lib/supabase/admin";

export const adminSessionLifetimeSeconds = 8 * 60 * 60;

export function setAdminAccessTokenCookies(response: NextResponse, token: string) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(adminAccessTokenCookieName, token, {
    httpOnly: true,
    maxAge: adminSessionLifetimeSeconds,
    path: "/admin",
    sameSite: "lax",
    secure,
  });
  response.headers.append(
    "Set-Cookie",
    `${adminAccessTokenCookieName}=${encodeURIComponent(token)}; Path=/api/media/admin; Max-Age=${adminSessionLifetimeSeconds}; HttpOnly; SameSite=Lax${
      secure ? "; Secure" : ""
    }`,
  );
}
