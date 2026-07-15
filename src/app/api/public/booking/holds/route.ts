import { NextResponse } from "next/server";

import {
  enforcePublicBookingRateLimit,
  publicBookingError,
  publicBookingServiceErrorResponse,
  readPublicBookingJson,
  rejectCrossOriginPublicBookingRequest,
} from "@/booking/http";
import { createPublicBookingHold } from "@/booking/service";
import { publicBookingSessionRateLimitKey } from "@/booking/security";
import { readPublicBookingSessionToken } from "@/booking/session";
import { parseCreateHoldPayload } from "@/booking/validation";

const ipRateLimitPolicy = { limit: 6, scope: "holds_ip", windowSeconds: 300 } as const;
const sessionRateLimitPolicy = { limit: 4, scope: "holds_session", windowSeconds: 300 } as const;
export async function POST(request: Request) {
  try {
    const originError = rejectCrossOriginPublicBookingRequest(request);
    if (originError) return originError;

    const sessionToken = readPublicBookingSessionToken(request);
    if (!sessionToken) return publicBookingError("booking_session_required", 428);
    const ipRateLimitError = await enforcePublicBookingRateLimit(request, ipRateLimitPolicy);
    if (ipRateLimitError) return ipRateLimitError;
    const sessionRateLimitError = await enforcePublicBookingRateLimit(request, {
      ...sessionRateLimitPolicy,
      keyHash: publicBookingSessionRateLimitKey(sessionToken, sessionRateLimitPolicy.scope),
    });
    if (sessionRateLimitError) return sessionRateLimitError;

    const payload = parseCreateHoldPayload(await readPublicBookingJson(request));
    if (!payload) return publicBookingError("invalid_request", 400);

    return NextResponse.json(
      await createPublicBookingHold({ ...payload, sessionToken }),
      { status: 201 },
    );
  } catch (error) {
    return publicBookingServiceErrorResponse(error);
  }
}
