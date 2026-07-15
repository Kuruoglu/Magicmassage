import { NextResponse } from "next/server";

import {
  enforcePublicBookingRateLimit,
  publicBookingError,
  publicBookingServiceErrorResponse,
  rejectCrossOriginPublicBookingRequest,
} from "@/booking/http";
import { getPublicBookingAvailability } from "@/booking/service";
import { parseAvailabilityQuery } from "@/booking/validation";

const rateLimitPolicy = { limit: 60, scope: "availability", windowSeconds: 60 } as const;

export async function GET(request: Request) {
  try {
    const originError = rejectCrossOriginPublicBookingRequest(request);
    if (originError) return originError;

    const rateLimitError = await enforcePublicBookingRateLimit(request, rateLimitPolicy);
    if (rateLimitError) return rateLimitError;

    const query = parseAvailabilityQuery(new URL(request.url));
    if (!query) return publicBookingError("invalid_request", 400);

    return NextResponse.json(await getPublicBookingAvailability(query));
  } catch (error) {
    return publicBookingServiceErrorResponse(error);
  }
}
