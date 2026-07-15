import { createHash, randomInt, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const bookingCookieName = "magic_booking_session";

function configuredValue(name: string) {
  return process.env[name]?.trim() || null;
}

function sofiaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Sofia",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

test("public booking restores and confirms a session hold", async ({ context, page }) => {
  const supabaseUrl = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = configuredValue("SUPABASE_SECRET_KEY");
  test.skip(!supabaseUrl || !secretKey, "Real Supabase service credentials are required.");
  test.setTimeout(120_000);

  const serviceClient = createClient(supabaseUrl!, secretKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const options = await serviceClient.rpc("public_booking_get_options", { p_locale: "en" });
  if (options.error) throw options.error;
  const priceVariantId = options.data?.services?.[0]?.variants?.[0]?.id;
  test.skip(!options.data?.enabled || typeof priceVariantId !== "string", "Public booking is intentionally unavailable.");

  const availability = await serviceClient.rpc("public_booking_get_availability", {
    p_days: 31,
    p_from: sofiaToday(),
    p_price_variant_id: priceVariantId,
  });
  if (availability.error) throw availability.error;
  test.skip(
    !availability.data?.days?.some((day: { slots?: unknown[] }) => Array.isArray(day.slots) && day.slots.length > 0),
    "The configured real booking calendar has no free slot in the next 31 days.",
  );

  const testClientName = `Playwright Booking Client ${randomUUID()}`;
  let testPhoneNormalized = "";
  for (let attempt = 0; attempt < 10 && !testPhoneNormalized; attempt += 1) {
    const candidate = `35988${randomInt(1_000_000, 10_000_000)}`;
    const existingClient = await serviceClient
      .from("admin_clients")
      .select("id")
      .eq("phone_normalized", candidate)
      .maybeSingle();
    if (existingClient.error) throw existingClient.error;
    if (!existingClient.data) testPhoneNormalized = candidate;
  }
  expect(testPhoneNormalized).not.toBe("");

  try {
    await page.goto("/en/booking");
    await page.getByRole("button", { name: /massage.+option/i }).first().click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Continue" }).click();

    // Avoid today's moving lead-time boundary while the real browser test is running.
    const availableDate = page.locator('button[aria-label*="Available"]:not([disabled])').last();
    await expect(availableDate).toBeVisible();
    await availableDate.click();

    const times = page.getByRole("region").filter({ has: page.getByRole("heading", { name: "Available times" }) });
    await times.getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(1);

    const selectedDate = await page.getByRole("definition").nth(2).textContent();
    const selectedTime = await page.getByRole("definition").nth(3).textContent();

    await page.goBack();
    await expect(page.getByRole("heading", { name: "Choose a date and time" })).toBeVisible();
    await page.getByRole("button", { name: selectedTime?.trim() ?? "" }).click();
    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeFocused();
    await expect(page.getByRole("definition").nth(2)).toHaveText(selectedDate ?? "");
    await expect(page.getByRole("definition").nth(3)).toHaveText(selectedTime ?? "");
    await expect(page.getByRole("timer")).toHaveCount(1);

    await page.goto("/ru/booking");
    await expect(page.getByRole("heading", { name: "Ваши контакты" })).toBeFocused();
    await page.goto("/en/booking");
    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.getByLabel("Name", { exact: true }).fill(testClientName);
    await page.getByRole("textbox", { name: "Phone", exact: true }).fill(`+${testPhoneNormalized}`);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Review your booking" })).toBeVisible();
    let confirmationCommitted = false;
    await page.route("**/api/public/booking/confirm", async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      confirmationCommitted = true;
      await route.abort("failed");
    });
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "We could not confirm" })).toBeVisible();
    expect(confirmationCommitted).toBe(true);
    await page.unroute("**/api/public/booking/confirm");
    await page.reload();

    const successHeading = page.getByRole("heading", { name: "Booking confirmed" });
    await expect(successHeading).toBeFocused();
    await expect(page.getByRole("status")).toHaveAccessibleName("Booking confirmed");

    await page.goto("/en/booking");
    await expect(page.getByRole("heading", { name: "Choose a service" })).toBeVisible();
  } finally {
    const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === bookingCookieName);
    const rawToken = sessionCookie?.value.split(".")[1];
    if (rawToken) {
      const sessionHash = createHash("sha256").update(rawToken, "utf8").digest("hex");
      const holds = await serviceClient
        .from("public_booking_holds")
        .select("id")
        .eq("session_key_hash", sessionHash);
      if (holds.error) throw holds.error;

      const holdIds = (holds.data ?? []).map((hold) => hold.id);
      if (holdIds.length > 0) {
        const appointments = await serviceClient
          .from("admin_appointments")
          .select("id, client_id")
          .in("public_booking_hold_id", holdIds);
        if (appointments.error) throw appointments.error;

        const appointmentIds = (appointments.data ?? []).map((appointment) => appointment.id);
        const clientIds = (appointments.data ?? []).map((appointment) => appointment.client_id);
        const clients = clientIds.length > 0
          ? await serviceClient
              .from("admin_clients")
              .select("id, full_name, phone_normalized")
              .in("id", clientIds)
          : { data: [], error: null };
        if (clients.error) throw clients.error;
        const ownedClientIds = (clients.data ?? [])
          .filter((client) =>
            client.full_name === testClientName
            && client.phone_normalized === testPhoneNormalized)
          .map((client) => client.id);
        if (appointmentIds.length > 0) {
          const auditCleanup = await serviceClient
            .from("admin_audit_log")
            .delete()
            .in("entity_id", appointmentIds);
          if (auditCleanup.error) throw auditCleanup.error;
          const appointmentCleanup = await serviceClient
            .from("admin_appointments")
            .delete()
            .in("id", appointmentIds);
          if (appointmentCleanup.error) throw appointmentCleanup.error;
        }
        if (ownedClientIds.length > 0) {
          const clientCleanup = await serviceClient.from("admin_clients").delete().in("id", ownedClientIds);
          if (clientCleanup.error) throw clientCleanup.error;
        }
      }

      const holdCleanup = await serviceClient
        .from("public_booking_holds")
        .delete()
        .eq("session_key_hash", sessionHash);
      if (holdCleanup.error) throw holdCleanup.error;
    }
  }
});
