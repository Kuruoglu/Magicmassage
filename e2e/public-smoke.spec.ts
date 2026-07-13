import { expect, test, type Request } from "@playwright/test";

const studio24BookingUrl = "https://studio24.bg/magic-massage-studio-natali-s8031";

test("public routes render and expose the Studio24 booking handoff", async ({ page }) => {
  for (const locale of ["bg", "ru", "ua", "en"]) {
    await page.goto(`/${locale}`);

    await expect(page.locator("h1")).toBeVisible();

    await page.goto(`/${locale}/gift-certificates`);

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("group", { name: /payment|плащане|оплата|оплата/i })).toBeVisible();
  }

  await page.goto("/bg");
  await expect(page.locator(`a[href="${studio24BookingUrl}"]`).first()).toBeVisible();
});

test("Google Maps follows persisted cookie consent choices", async ({ page }) => {
  const isGoogleMapRequest = (request: Request) => request.url().includes("google.com/maps");
  const googleMapRequests: string[] = [];
  page.on("request", (request) => {
    if (isGoogleMapRequest(request)) {
      googleMapRequests.push(request.url());
    }
  });

  await page.goto("/en/contacts");

  const mapFrame = page.locator('iframe[src*="google.com/maps"]');
  const cookieBanner = page.getByLabel("Cookie consent");
  await expect(mapFrame).toHaveCount(0);
  await expect(cookieBanner.getByRole("button", { name: "Reject non-essential" })).toBeVisible();
  expect(googleMapRequests).toHaveLength(0);

  await cookieBanner.getByRole("button", { name: "Reject non-essential" }).click();
  await page.reload();

  await expect(mapFrame).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change cookie preferences" })).toBeVisible();
  expect(googleMapRequests).toHaveLength(0);

  await page.getByRole("button", { name: "Change cookie preferences" }).click();
  await expect(cookieBanner.getByRole("checkbox", { name: "Google Maps" })).toBeChecked();
  const acceptedMapRequest = page.waitForRequest(isGoogleMapRequest);
  await cookieBanner.getByRole("button", { name: "Accept all" }).click();

  await acceptedMapRequest;
  await expect(mapFrame).toBeVisible();

  const persistedMapRequest = page.waitForRequest(isGoogleMapRequest);
  await page.reload();

  await persistedMapRequest;
  await expect(mapFrame).toBeVisible();
  await expect(page.getByRole("button", { name: "Change cookie preferences" })).toBeVisible();
});

test("mobile menu is inert while closed and keyboard-safe while open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ru/contacts");

  const mobileMenu = page.getByTestId("mobile-menu");
  await expect(mobileMenu).toHaveAttribute("inert", "");

  await page.getByRole("button", { name: "Open menu" }).click();

  await expect(mobileMenu).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(mobileMenu).toHaveAttribute("inert", "");
});

test("gift certificate page fits mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ru/gift-certificates");

  await expect(page.getByRole("heading", { name: /сертификаты/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Добавить массаж" })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);

  const consentLayout = await page.evaluate(() => {
    const form = document.querySelector(".gift-form")?.getBoundingClientRect();
    const consent = document.querySelector(".cookie-consent")?.getBoundingClientRect();
    const consentElement = document.querySelector(".cookie-consent");

    if (!form || !consent || !consentElement) {
      return null;
    }

    return {
      position: window.getComputedStyle(consentElement).position,
      overlapsForm:
        consent.bottom > form.top &&
        consent.top < form.bottom &&
        consent.right > form.left &&
        consent.left < form.right,
    };
  });

  expect(consentLayout).toEqual({
    position: "static",
    overlapsForm: false,
  });
});
