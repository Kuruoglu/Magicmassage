import { businessFacts, externalLinkProps } from "./business";

export const studio24BookingUrl = businessFacts.bookingUrl;

export const externalBookingLinkProps = {
  href: studio24BookingUrl,
  ...externalLinkProps,
} as const;
