import { NextResponse } from "next/server";

import {
  enforcePublicBookingRateLimit,
  publicBookingError,
  publicBookingServiceErrorResponse,
  rejectCrossOriginPublicBookingRequest,
} from "@/booking/http";
import {
  getPublicBookingOptions,
  restorePublicBookingConfirmation,
  restorePublicBookingHold,
} from "@/booking/service";
import {
  attachPublicBookingSessionCookie,
  createPublicBookingSession,
  readPublicBookingSessionToken,
} from "@/booking/session";
import { parseOptionsQuery } from "@/booking/validation";

const rateLimitPolicy = { limit: 30, scope: "options", windowSeconds: 60 } as const;
const sessionIssueRateLimitPolicy = { limit: 6, scope: "booking_session_issue", windowSeconds: 300 } as const;

export async function GET(request: Request) {
  try {
    const originError = rejectCrossOriginPublicBookingRequest(request);
    if (originError) return originError;

    const rateLimitError = await enforcePublicBookingRateLimit(request, rateLimitPolicy);
    if (rateLimitError) return rateLimitError;

    const query = parseOptionsQuery(new URL(request.url));
    if (!query) return publicBookingError("invalid_request", 400);

    const existingSessionToken = readPublicBookingSessionToken(request);
    if (!existingSessionToken) {
      const sessionRateLimitError = await enforcePublicBookingRateLimit(request, sessionIssueRateLimitPolicy);
      if (sessionRateLimitError) return sessionRateLimitError;
    }

    const options = await getPublicBookingOptions(query.locale);
    const activeHold = existingSessionToken
      ? await restorePublicBookingHold(existingSessionToken)
      : null;
    const confirmation = existingSessionToken && !activeHold && query.recoverConfirmation
      ? await restorePublicBookingConfirmation(existingSessionToken)
      : null;
    const visibleActiveHold = activeHold && options.services.some((service) =>
      service.slug === activeHold.serviceSlug
      && service.variants.some((variant) => variant.id === activeHold.priceVariantId))
      ? activeHold
      : null;
    const response = NextResponse.json({ ...options, activeHold: visibleActiveHold, confirmation });

    if (existingSessionToken) return response;

    const session = createPublicBookingSession();
    return attachPublicBookingSessionCookie(response, request, session.cookieValue);
  } catch (error) {
    return publicBookingServiceErrorResponse(error);
  }
}
