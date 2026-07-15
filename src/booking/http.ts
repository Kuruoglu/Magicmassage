import "server-only";

import { NextResponse } from "next/server";

import { isAllowedPublicBookingOrigin, publicBookingRateLimitKey } from "./security";
import { consumePublicBookingRateLimit, PublicBookingServiceError } from "./service";

type RateLimitPolicy = {
  keyHash?: string;
  limit: number;
  scope: string;
  windowSeconds: number;
};

export function publicBookingError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function readPublicBookingJson(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return null;

  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function rejectCrossOriginPublicBookingRequest(request: Request) {
  return isAllowedPublicBookingOrigin(request) ? null : publicBookingError("invalid_request", 403);
}

export async function enforcePublicBookingRateLimit(request: Request, policy: RateLimitPolicy) {
  const allowed = await consumePublicBookingRateLimit({
    ...policy,
    keyHash: policy.keyHash ?? publicBookingRateLimitKey(request, policy.scope),
  });

  return allowed ? null : publicBookingError("rate_limited", 429);
}

export function publicBookingServiceErrorResponse(error: unknown) {
  if (error instanceof PublicBookingServiceError) {
    if (error.code === "invalid_request") return publicBookingError(error.code, 400);
    if (error.code === "cap_reached" || error.code === "slot_unavailable") {
      return publicBookingError(error.code, 409);
    }

    return publicBookingError("booking_unavailable", 503);
  }

  console.error("Public booking route failed", {
    cause: error instanceof Error ? error.name : "unknown",
  });
  return publicBookingError("booking_unavailable", 503);
}
