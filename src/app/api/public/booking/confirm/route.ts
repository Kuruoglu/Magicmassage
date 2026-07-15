import { NextResponse } from "next/server";

import {
  enforcePublicBookingRateLimit,
  publicBookingError,
  publicBookingServiceErrorResponse,
  readPublicBookingJson,
  rejectCrossOriginPublicBookingRequest,
} from "@/booking/http";
import { confirmPublicBooking } from "@/booking/service";
import { readPublicBookingSessionToken } from "@/booking/session";
import { parseConfirmPayload } from "@/booking/validation";

const rateLimitPolicy = { limit: 8, scope: "confirm", windowSeconds: 600 } as const;

export async function POST(request: Request) {
  try {
    const originError = rejectCrossOriginPublicBookingRequest(request);
    if (originError) return originError;

    const sessionToken = readPublicBookingSessionToken(request);
    if (!sessionToken) return publicBookingError("booking_session_required", 428);

    const rateLimitError = await enforcePublicBookingRateLimit(request, rateLimitPolicy);
    if (rateLimitError) return rateLimitError;

    const payload = parseConfirmPayload(
      await readPublicBookingJson(request),
      request.headers.get("idempotency-key"),
    );
    if (!payload) return publicBookingError("invalid_request", 400);

    return NextResponse.json(await confirmPublicBooking({ ...payload, sessionToken }));
  } catch (error) {
    return publicBookingServiceErrorResponse(error);
  }
}
