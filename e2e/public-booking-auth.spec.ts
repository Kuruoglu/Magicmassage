import { createHash, randomInt, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const bookingCookieName = "magic_booking_session";
const transientSupabaseError = /fetch failed|network|socket|unrecognized JWT kid/i;

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

function monthDistance(from: string, to: string) {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + toMonth - fromMonth;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withTransientSupabaseRetries<Result extends { error?: { message?: string } | null }>(
  operation: () => PromiseLike<Result>,
  attempts = 8,
) {
  let lastResult: Result | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await operation();
    if (!lastResult.error || !transientSupabaseError.test(lastResult.error.message ?? "")) {
      return lastResult;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 1_000, 5_000)));
    }
  }
  return lastResult!;
}

function isMissingEmailOutbox(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || /email_notifications.*(?:schema cache|does not exist)/i.test(error?.message ?? "");
}

function isMissingOwnerNotificationSetting(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42703"
    || error?.code === "PGRST204"
    || /owner_notifications_enabled.*(?:schema cache|does not exist)/i.test(error?.message ?? "");
}

test("public booking restores and confirms a session hold", async ({ context, page }) => {
  const supabaseUrl = configuredValue("NEXT_PUBLIC_SUPABASE_URL");
  const secretKey = configuredValue("SUPABASE_SECRET_KEY");
  test.skip(!supabaseUrl || !secretKey, "Real Supabase service credentials are required.");
  test.setTimeout(120_000);

  const serviceClient = createClient(supabaseUrl!, secretKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const options = await serviceClient.rpc("public_booking_get_options_v2", { p_locale: "en" });
  if (options.error) throw options.error;
  const notificationSettings = await withTransientSupabaseRetries(() =>
    serviceClient
      .from("admin_site_settings")
      .select("owner_notifications_enabled")
      .eq("id", "site")
      .maybeSingle());
  if (notificationSettings.error && !isMissingOwnerNotificationSetting(notificationSettings.error)) {
    throw notificationSettings.error;
  }
  test.skip(
    notificationSettings.data?.owner_notifications_enabled === true,
    "Live owner notifications must be disabled before confirming a real E2E booking.",
  );
  const priceVariantId = options.data?.services?.[0]?.variants?.[0]?.id;
  test.skip(!options.data?.enabled || typeof priceVariantId !== "string", "Public booking is intentionally unavailable.");

  const today = sofiaToday();
  const availability = await serviceClient.rpc("public_booking_get_availability_v3", {
    p_days: 31,
    p_from: today,
    p_price_variant_id: priceVariantId,
    p_specialist_slug: null,
  });
  if (availability.error) throw availability.error;
  const targetDay = availability.data?.days?.find(
    (day: { date?: unknown; slots?: unknown[] }) => typeof day.date === "string"
      && day.date > today
      && Array.isArray(day.slots)
      && day.slots.length > 0,
  );
  test.skip(!targetDay, "The configured real booking calendar has no free future slot in the next 31 days.");
  if (!targetDay || typeof targetDay.date !== "string") return;
  const targetDate = targetDay.date;

  const runId = configuredValue("E2E_ADMIN_RUN_ID") ?? randomUUID();
  const testClientPrefix = `Playwright Booking Client ${runId}`;
  const testClientName = `${testClientPrefix} ${randomUUID()}`;
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
    await expect(page.getByRole("heading", { name: "Choose a specialist" })).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.setViewportSize({ width: 320, height: 740 });
    const calendarHasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(calendarHasHorizontalOverflow).toBe(false);
    await page.setViewportSize({ width: 1280, height: 900 });

    for (let offset = monthDistance(sofiaToday().slice(0, 7), targetDate.slice(0, 7)); offset > 0; offset -= 1) {
      await page.getByRole("button", { name: /^Next month:/ }).click();
    }
    const formattedTargetDate = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      weekday: "long",
      year: "numeric",
    }).format(new Date(`${targetDate}T12:00:00`));
    const availableDate = page.getByRole("button", {
      name: new RegExp(`^${escapeRegExp(formattedTargetDate)}, (Available|Limited)$`),
    });
    await expect(availableDate).toBeVisible();
    await availableDate.click();

    const times = page.getByRole("region").filter({ has: page.getByRole("heading", { name: "Available times" }) });
    await times.getByRole("button").first().click();
    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(1);

    const selectedDate = await page.getByRole("definition").nth(3).textContent();
    const selectedTime = await page.getByRole("definition").nth(4).textContent();

    await page.goBack();
    await expect(page.getByRole("heading", { name: "Choose a date and time" })).toBeVisible();
    await page.getByRole("button", { name: selectedTime?.trim() ?? "" }).click();
    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { name: "Your contact details" })).toBeFocused();
    await expect(page.getByRole("definition").nth(3)).toHaveText(selectedDate ?? "");
    await expect(page.getByRole("definition").nth(4)).toHaveText(selectedTime ?? "");
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
    await page.getByRole("checkbox", { name: "I agree to the privacy policy." }).check();
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
    const cleanupFailures: string[] = [];
    const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === bookingCookieName);
    const rawToken = sessionCookie?.value.split(".")[1];
    const sessionHash = rawToken
      ? createHash("sha256").update(rawToken, "utf8").digest("hex")
      : null;
    const discoveryResults = await Promise.allSettled([
      withTransientSupabaseRetries(() =>
        serviceClient
          .from("admin_clients")
          .select("id")
          .like("full_name", `${testClientPrefix} %`)),
      sessionHash
        ? withTransientSupabaseRetries(() =>
            serviceClient
              .from("public_booking_holds")
              .select("id")
              .eq("session_key_hash", sessionHash))
        : Promise.resolve({ data: [], error: null }),
    ]);
    const ownedClientIds: string[] = [];
    const holdIds: string[] = [];
    for (const [index, discovery] of discoveryResults.entries()) {
      if (discovery.status === "rejected") {
        cleanupFailures.push(`fixture discovery ${index + 1}: ${String(discovery.reason)}`);
        continue;
      }
      if (discovery.value.error) {
        cleanupFailures.push(`fixture discovery ${index + 1}: ${discovery.value.error.message}`);
        continue;
      }
      const ids = (discovery.value.data ?? []).map((row) => row.id);
      (index === 0 ? ownedClientIds : holdIds).push(...ids);
    }

    const appointmentDiscoveries = await Promise.allSettled([
      ownedClientIds.length > 0
        ? withTransientSupabaseRetries(() =>
            serviceClient
              .from("admin_appointments")
              .select("id, public_booking_hold_id")
              .in("client_id", ownedClientIds))
        : Promise.resolve({ data: [], error: null }),
      holdIds.length > 0
        ? withTransientSupabaseRetries(() =>
            serviceClient
              .from("admin_appointments")
              .select("id, public_booking_hold_id")
              .in("public_booking_hold_id", holdIds))
        : Promise.resolve({ data: [], error: null }),
    ]);
    const appointmentIds = new Set<string>();
    for (const [index, discovery] of appointmentDiscoveries.entries()) {
      if (discovery.status === "rejected") {
        cleanupFailures.push(`appointment discovery ${index + 1}: ${String(discovery.reason)}`);
        continue;
      }
      if (discovery.value.error) {
        cleanupFailures.push(`appointment discovery ${index + 1}: ${discovery.value.error.message}`);
        continue;
      }
      for (const appointment of discovery.value.data ?? []) {
        appointmentIds.add(appointment.id);
        if (appointment.public_booking_hold_id) holdIds.push(appointment.public_booking_hold_id);
      }
    }

    const uniqueAppointmentIds = [...appointmentIds];
    const uniqueHoldIds = [...new Set(holdIds)];
    const cleanupSteps: Array<[
      string,
      () => PromiseLike<{ error: { code?: string; message: string } | null }>,
      ((error: { code?: string; message?: string } | null) => boolean)?,
    ]> = [];
    if (uniqueAppointmentIds.length > 0) {
      cleanupSteps.push(
        [
          "notification cleanup",
          () => serviceClient
            .from("email_notifications")
            .delete()
            .eq("aggregate_type", "appointment")
            .in("aggregate_id", uniqueAppointmentIds),
          isMissingEmailOutbox,
        ],
        [
          "audit cleanup",
          () => serviceClient.from("admin_audit_log").delete().in("entity_id", uniqueAppointmentIds),
        ],
        [
          "appointment cleanup",
          () => serviceClient.from("admin_appointments").delete().in("id", uniqueAppointmentIds),
        ],
      );
    }
    if (ownedClientIds.length > 0) {
      cleanupSteps.push([
        "client cleanup",
        () => serviceClient.from("admin_clients").delete().in("id", ownedClientIds),
      ]);
    }
    if (uniqueHoldIds.length > 0) {
      cleanupSteps.push([
        "hold cleanup",
        () => serviceClient.from("public_booking_holds").delete().in("id", uniqueHoldIds),
      ]);
    }

    for (const [label, cleanup, ignoredError] of cleanupSteps) {
      try {
        const result = await withTransientSupabaseRetries(cleanup);
        if (result.error && !ignoredError?.(result.error)) {
          cleanupFailures.push(`${label}: ${result.error.message}`);
        }
      } catch (error) {
        cleanupFailures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (cleanupFailures.length > 0) {
      throw new Error(cleanupFailures.join("; "));
    }
  }
});
