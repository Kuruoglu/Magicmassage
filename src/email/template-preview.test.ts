import { describe, expect, it } from "vitest";

import { renderEmailTemplatePreview } from "./template-preview";

describe("email template preview", () => {
  it("uses the production renderer with safe representative data", () => {
    const preview = renderEmailTemplatePreview("booking_rescheduled", "en");

    expect(preview.templateVersion).toBe(1);
    expect(preview.subject).toContain("Magic Massage Natali");
    expect(preview.text).toContain("MM-EXAMPLE");
    expect(preview.text).toContain("25.07.2026, 14:00");
    expect(preview.html).toContain('<html lang="en">');
    expect(preview.html).not.toContain("preview@example.invalid");
  });

  it("includes the safe preview unsubscribe path for care emails", () => {
    const preview = renderEmailTemplatePreview("booking_care", "ru");

    expect(preview.html).toContain("/ru/email-preferences?token=");
    expect(preview.text).toContain("https://example.com/review");
  });

  it("keeps owner and gift samples aligned with their minimal delivery payloads", () => {
    const ownerBooking = renderEmailTemplatePreview("owner_new_public_booking", "en");
    const giftRecipient = renderEmailTemplatePreview("gift_recipient", "en");

    expect(ownerBooking.text).toContain("MM-EXAMPLE");
    expect(ownerBooking.text).not.toContain("Maria (sample)");
    expect(ownerBooking.text).not.toContain("+359");
    expect(giftRecipient.text).toContain("GIFT-EXAMPLE");
    expect(giftRecipient.text).not.toContain("25.07.2026");
    expect(giftRecipient.text).not.toContain("Classic massage");
  });
});
