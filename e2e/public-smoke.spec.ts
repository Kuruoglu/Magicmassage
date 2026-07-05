import { expect, test } from "@playwright/test";

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

test("Google Maps waits for cookie consent on contacts", async ({ page }) => {
  await page.goto("/bg/contacts");

  await expect(page.locator('iframe[src*="google.com/maps"]')).toHaveCount(0);
  const cookieBanner = page.getByLabel("Cookie consent");
  await expect(cookieBanner.getByRole("button", { name: /cookies/i })).toBeVisible();

  await cookieBanner.getByRole("button", { name: /cookies/i }).click();

  await expect(page.locator('iframe[src*="google.com/maps"]')).toBeVisible();
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
});
