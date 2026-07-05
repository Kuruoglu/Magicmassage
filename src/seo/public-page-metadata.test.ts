import { describe, expect, it } from "vitest";

import { createPublicPageMetadata } from "./public-page-metadata";

describe("public page metadata", () => {
  it("creates localized canonical and alternate URLs for public pages", () => {
    const services = createPublicPageMetadata("bg", "services");
    const about = createPublicPageMetadata("ru", "about");
    const contacts = createPublicPageMetadata("ua", "contacts");

    expect(services.alternates?.canonical).toBe("/bg/services");
    expect(services.alternates?.languages?.["ru"]).toBe("/ru/services");
    expect(services.alternates?.languages?.["en"]).toBe("/en/services");
    expect(about.alternates?.canonical).toBe("/ru/about");
    expect(contacts.alternates?.canonical).toBe("/ua/contacts");
    expect(contacts.alternates?.languages?.["uk-UA"]).toBe("/ua/contacts");
    expect(createPublicPageMetadata("en", "contacts").alternates?.canonical).toBe("/en/contacts");
  });

  it("creates metadata for localized gift certificate pages", () => {
    const metadata = createPublicPageMetadata("en", "giftCertificates");

    expect(metadata.title).toBe("Massage gift certificates");
    expect(metadata.description).toContain("Gift certificates");
    expect(metadata.alternates?.canonical).toBe("/en/gift-certificates");
    expect(metadata.alternates?.languages?.["bg-BG"]).toBe("/bg/gift-certificates");
    expect(metadata.alternates?.languages?.["uk-UA"]).toBe("/ua/gift-certificates");
    expect(metadata.alternates?.languages?.["x-default"]).toBe("/bg/gift-certificates");
  });
});
