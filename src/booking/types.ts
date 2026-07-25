export const publicBookingLocales = ["bg", "ru", "ua", "en"] as const;
export const publicBookingContactPreferences = ["phone", "viber", "telegram", "email"] as const;

export type PublicBookingLocale = (typeof publicBookingLocales)[number];
export type PublicBookingContactPreference = (typeof publicBookingContactPreferences)[number];

export type PublicBookingPriceVariant = {
  currency: string;
  durationMinutes: number;
  id: string;
  priceCents: number;
};

export type PublicBookingSpecialist = {
  displayName: string;
  id: string;
};

export type PublicBookingService = {
  category: string;
  slug: string;
  specialists: PublicBookingSpecialist[];
  title: string;
  variants: PublicBookingPriceVariant[];
};

export type PublicBookingOptions = {
  bufferMinutes: number;
  dailyLimit: number;
  enabled: boolean;
  holdMinutes: number;
  horizonDays: number;
  minLeadMinutes: number;
  services: PublicBookingService[];
  slotStepMinutes: number;
  timezone: "Europe/Sofia";
};

export type PublicBookingAvailabilityDay = {
  capReached: boolean;
  date: string;
  slots: string[];
};

export type PublicBookingAvailability = {
  days: PublicBookingAvailabilityDay[];
  enabled: boolean;
  from?: string;
  priceVariantId?: string;
  timezone: "Europe/Sofia";
};

export type PublicBookingHold = {
  currency: string;
  date: string;
  durationMinutes: number;
  expiresAt: string;
  holdToken: string;
  priceVariantId: string;
  priceCents: number;
  selectionId: string;
  selectionVersion: number;
  specialistId: string;
  specialistName: string;
  time: string;
};

export type PublicBookingRestoredHold = PublicBookingHold & {
  serviceSlug: string;
};

export type PublicBookingConfirmation = {
  currency: string;
  date: string;
  durationMinutes: number;
  priceCents: number;
  priceVariantId: string;
  publicReference: string;
  serviceName: string;
  serviceSlug: string;
  specialistId?: string;
  specialistName: string;
  status: string;
  time: string;
};

export type CreatePublicBookingHoldInput = {
  date: string;
  priceVariantId: string;
  specialistId?: string;
  time: string;
};

export type ConfirmPublicBookingInput = {
  careEmailOptIn: boolean;
  contactPreference: PublicBookingContactPreference;
  email: string | null;
  fullName: string;
  holdToken: string;
  idempotencyKey: string;
  locale: PublicBookingLocale;
  note: string;
  phone: string;
  phoneNormalized: string;
  privacyAccepted: true;
  selectionId: string;
  selectionVersion: number;
};

export type PublicBookingErrorCode =
  | "booking_unavailable"
  | "cap_reached"
  | "invalid_request"
  | "slot_unavailable";
