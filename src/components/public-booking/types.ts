export type BookingVariant = {
  currency: string;
  durationMinutes: number;
  id: string;
  priceCents: number;
};

export type BookingService = {
  category?: string;
  slug: string;
  title: string;
  variants: BookingVariant[];
};

export type BookingOptions = {
  activeHold: BookingRestoredHold | null;
  confirmation: BookingConfirmation | null;
  enabled: boolean;
  horizonDays: number;
  policy?: unknown;
  services: BookingService[];
};

export type BookingRestoredHold = BookingHold & {
  date: string;
  priceVariantId: string;
  serviceSlug: string;
  time: string;
};

export type BookingAvailabilityDate = {
  availability: "available" | "limited" | "unavailable";
  date: string;
  slots: string[];
};

export type BookingAvailability = {
  dates: BookingAvailabilityDate[];
};

export type BookingHold = {
  currency: string;
  durationMinutes: number;
  expiresAt: string;
  holdToken: string;
  priceCents: number;
  selectionId: string;
  selectionVersion: number;
};

export type BookingConfirmation = {
  appointment: {
    currency: string;
    date: string;
    durationMinutes: number;
    priceCents: number;
    priceVariantId: string;
    serviceName: string;
    serviceSlug: string;
    time: string;
  };
  reference: string;
  status: "confirmed";
};

export type BookingContactPreference = "phone" | "viber" | "telegram" | "email";

export type BookingContact = {
  contactPreference: BookingContactPreference;
  email: string;
  name: string;
  phone: string;
  privacyAccepted: boolean;
};

export type ActiveBookingHold = BookingHold & {
  idempotencyKey: string;
};

export type BookingStep = "service" | "variant" | "schedule" | "details" | "review";
