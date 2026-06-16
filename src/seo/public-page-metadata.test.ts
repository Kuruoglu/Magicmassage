import { describe, expect, it } from "vitest";

import { createPublicPageMetadata } from "./public-page-metadata";

describe("public page metadata", () => {
  it("creates localized canonical and alternate URLs for public pages", () => {
    const services = createPublicPageMetadata("bg", "services");
    const about = createPublicPageMetadata("ru", "about");
    const contacts = createPublicPageMetadata("ua", "contacts");

    expect(services.alternates?.canonical).toBe("/bg/services");
    expect(services.alternates?.languages?.["ru"]).toBe("/ru/services");
    expect(about.alternates?.canonical).toBe("/ru/about");
    expect(contacts.alternates?.canonical).toBe("/ua/contacts");
    expect(contacts.alternates?.languages?.["uk-UA"]).toBe("/ua/contacts");
  });
});
