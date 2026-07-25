import { describe, expect, it } from "vitest";

import { escapeEmailHtml, normalizeEmailLocale, renderTransactionalEmail } from "./templates";
import type { EmailNotification } from "./types";

function notification(overrides: Partial<EmailNotification> = {}): EmailNotification {
  return {
    aggregate_id: "appointment-1",
    aggregate_type: "appointment",
    attempt_count: 1,
    dedupe_key: "booking_confirmed:appointment-1:v1",
    due_at: new Date().toISOString(),
    event_type: "booking_confirmed",
    id: "11111111-1111-4111-8111-111111111111",
    lease_token: "22222222-2222-4222-8222-222222222222",
    locale: "en",
    payload: {
      address: "Sofia <center>",
      clientName: "A & B",
      date: "2026-08-01",
      publicReference: "MMN-1",
      salonContact: "+359 88 123 4567",
      serviceName: "Massage",
      time: "10:00",
    },
    recipient_email: "client@example.com",
    template_key: "booking_confirmed",
    template_version: 1,
    ...overrides,
  };
}

describe("transactional email templates", () => {
  it("supports all locales and falls back to Bulgarian", () => {
    expect(normalizeEmailLocale("missing")).toBe("bg");
    for (const locale of ["bg", "ru", "ua", "en"] as const) {
      const rendered = renderTransactionalEmail(notification({ locale }));
      expect(rendered.subject).toContain("Magic Massage Natali");
      expect(rendered.html).toContain('lang="');
      expect(rendered.text).toContain("MMN-1");
    }
  });

  it("escapes every untrusted payload value", () => {
    const rendered = renderTransactionalEmail(notification());
    expect(rendered.html).toContain("A &amp; B");
    expect(rendered.html).toContain("Sofia &lt;center&gt;");
    expect(rendered.html).not.toContain("Sofia <center>");
    expect(escapeEmailHtml('"<>&\'')).toBe("&quot;&lt;&gt;&amp;&#39;");
  });

  it("renders care review, booking, and signed unsubscribe links", () => {
    const rendered = renderTransactionalEmail(notification({
      event_type: "booking_care",
      payload: {
        bookingUrl: "https://example.com/en/booking",
        reviewUrl: "https://reviews.example.com/magic",
      },
      template_key: "booking_care",
    }), {
      env: { EMAIL_PREFERENCES_SECRET: "test-secret", NODE_ENV: "test" },
      siteUrl: "https://example.com",
    });

    expect(rendered.html).toContain("https://reviews.example.com/magic");
    expect(rendered.html).toContain("/en/email-preferences?token=");
    expect(rendered.text).toContain("https://example.com/en/booking");
  });

  it("renders a resolved CRM action for owner notifications", () => {
    const rendered = renderTransactionalEmail(notification({
      event_type: "owner_new_public_booking",
      payload: { adminUrl: "https://example.com/admin?section=calendar" },
      template_key: "owner_new_public_booking",
    }));
    expect(rendered.html).toContain("https://example.com/admin?section=calendar");
  });

  it("renders every event in every supported locale", () => {
    const events: EmailNotification["event_type"][] = [
      "booking_confirmed", "booking_rescheduled", "booking_cancelled",
      "booking_reminder_24h", "booking_care", "owner_new_public_booking",
      "gift_buyer", "gift_recipient", "owner_gift_purchase",
    ];
    for (const locale of ["bg", "ru", "ua", "en"] as const) {
      for (const event_type of events) {
        const rendered = renderTransactionalEmail(notification({
          event_type,
          locale,
          template_key: event_type,
        }), {
          env: { EMAIL_PREFERENCES_SECRET: "test-secret", NODE_ENV: "test" },
          siteUrl: "https://example.com",
        });
        expect(rendered.subject).toContain("Magic Massage Natali");
        expect(rendered.html).toContain(`<html lang="${locale}">`);
        expect(rendered.text.length).toBeGreaterThan(10);
      }
    }
  });
});
