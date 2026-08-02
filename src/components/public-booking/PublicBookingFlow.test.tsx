import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicBookingFlow } from "./PublicBookingFlow";

const options = {
  enabled: true,
  horizonDays: 31,
  services: [
    {
      slug: "classic-massage",
      specialists: [
        { id: "specialist-natali", displayName: "Natalia Petrova" },
        { id: "specialist-elena", displayName: "Elena Ivanova" },
      ],
      title: "Classic massage",
      variants: [{ id: "variant-60", durationMinutes: 60, priceCents: 5000, currency: "EUR" }],
    },
  ],
};

const availability = {
  days: [
    { date: "2026-07-20", capReached: false, slots: ["10:00", "11:30", "13:00", "14:30"] },
    { date: "2026-07-21", capReached: false, slots: ["15:00"] },
    { date: "2026-07-22", capReached: true, slots: ["10:00"] },
  ],
  enabled: true,
  from: "2026-07-14",
  priceVariantId: "variant-60",
  timezone: "Europe/Sofia",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function chooseSpecialist(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp | string = /Any available specialist/i,
) {
  await user.click(await screen.findByRole("radio", { name }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/en/booking");
});

describe("PublicBookingFlow", () => {
  it("completes the assigned options, availability, hold and confirm flow", async () => {
    const requests: Array<{ body?: string; headers?: HeadersInit; method?: string; url: string }> = [];
    let confirmAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({
        body: init?.body as string | undefined,
        headers: init?.headers,
        method: init?.method,
        url,
      });

      if (url.startsWith("/api/public/booking/options")) return jsonResponse(options);
      if (url.startsWith("/api/public/booking/availability")) return jsonResponse(availability);
      if (url === "/api/public/booking/holds") {
        return jsonResponse({
          currency: "EUR",
          durationMinutes: 60,
          holdToken: "hold-token",
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          priceCents: 5500,
          selectionId: "11111111-1111-4111-8111-111111111111",
          selectionVersion: 1,
          specialistId: "specialist-natali",
          specialistName: "Natalia Petrova",
        }, 201);
      }
      if (url === "/api/public/booking/confirm") {
        confirmAttempts += 1;
        if (confirmAttempts === 1) return jsonResponse({ code: "temporary_failure" }, 500);
        return jsonResponse({
          currency: "EUR",
          durationMinutes: 60,
          priceCents: 5000,
          publicReference: "MMN-2026-0042",
          serviceName: "Classic massage",
          status: "confirmed",
          date: "2026-07-20",
          time: "10:00",
          serviceSlug: "classic-massage",
          specialistId: "specialist-natali",
          specialistName: "Natalia Petrova",
          priceVariantId: "variant-60",
        });
      }
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" />);

    const serviceButton = await screen.findByRole("button", { name: /Classic massage/i });
    const stepHeading = screen.getByRole("heading", { name: "Choose a service" });
    const stepHint = screen.getByText("We will show options and times only for the selected massage.");
    // Google Translate replaces React-owned text nodes with nested font elements.
    for (const translatedElement of [stepHeading, stepHint]) {
      const translatedText = document.createTreeWalker(translatedElement, 4).nextNode();
      expect(translatedText).toBeInstanceOf(Text);
      const innerTranslationWrapper = document.createElement("font");
      const outerTranslationWrapper = document.createElement("font");
      innerTranslationWrapper.textContent = translatedText?.textContent ?? "";
      outerTranslationWrapper.append(innerTranslationWrapper);
      translatedText?.parentNode?.replaceChild(outerTranslationWrapper, translatedText);
    }

    await user.click(serviceButton);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Choose a duration" })).toBeInTheDocument();
    expect(screen.getByText("The price and duration are fixed for this option.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Choose a specialist" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    await chooseSpecialist(user, "Natalia Petrova");

    expect(await screen.findByRole("button", { name: /20 July 2026, Available/i })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "Date and time" })).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Choose a time" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10:00" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /22 July 2026, Unavailable/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Choose a specialist" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Natalia Petrova" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.click(screen.getByRole("button", { name: /20 July 2026, Available/i }));
    await user.click(screen.getByRole("button", { name: "10:00" }));

    expect(await screen.findByRole("heading", { name: "Your contact details" })).toBeInTheDocument();
    expect(screen.getAllByRole("timer")).toHaveLength(1);
    expect(screen.getByRole("timer")).toHaveTextContent(/04:5\d|05:00/);
    await user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Choose a date and time" });
    await user.click(screen.getByRole("button", { name: "10:00" }));
    expect(await screen.findByRole("heading", { name: "Your contact details" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Anna Petrova");
    await user.type(screen.getAllByLabelText("Phone")[0], "+359 88 123 4567");
    const careEmailConsent = screen.getByRole("checkbox", { name: /follow-up email/i });
    expect(careEmailConsent).not.toBeChecked();
    expect(careEmailConsent).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /privacy policy/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Review your booking" })).toBeInTheDocument();
    expect(screen.getByText("Anna Petrova")).toBeInTheDocument();
    expect(screen.getAllByText(/€55\.00/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not confirm");
    expect(screen.getByRole("heading", { name: "Review your booking" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm booking" }));

    expect(await screen.findByRole("heading", { name: "Booking confirmed" })).toBeInTheDocument();
    expect(screen.getByText("MMN-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("Natalia Petrova")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAccessibleName("Booking confirmed");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Booking confirmed" })).toHaveFocus());

    const holdRequest = requests.find((request) => request.url === "/api/public/booking/holds");
    expect(requests.filter((request) => request.url === "/api/public/booking/holds")).toHaveLength(1);
    expect(JSON.parse(holdRequest?.body ?? "{}")).toEqual({
      date: "2026-07-20",
      priceVariantId: "variant-60",
      specialistId: "specialist-natali",
      time: "10:00",
      website: "",
    });
    const availabilityRequest = requests.find((request) => request.url.startsWith("/api/public/booking/availability"));
    expect(availabilityRequest?.url).toContain("priceVariantId=variant-60");
    expect(availabilityRequest?.url).toContain("specialistId=specialist-natali");
    expect(availabilityRequest?.url).toContain("days=31");
    expect(availabilityRequest?.url).toMatch(/from=\d{4}-\d{2}-\d{2}/);

    const confirmRequests = requests.filter((request) => request.url === "/api/public/booking/confirm");
    expect(confirmRequests).toHaveLength(2);
    expect(JSON.parse(confirmRequests[0].body ?? "{}")).toEqual({
      careEmailOptIn: false,
      email: "",
      fullName: "Anna Petrova",
      holdToken: "hold-token",
      locale: "en",
      contactPreference: "phone",
      note: "",
      phone: "+359 88 123 4567",
      privacyAccepted: true,
      selectionId: "11111111-1111-4111-8111-111111111111",
      selectionVersion: 1,
      website: "",
    });
    const firstIdempotencyKey = new Headers(confirmRequests[0].headers).get("Idempotency-Key");
    const secondIdempotencyKey = new Headers(confirmRequests[1].headers).get("Idempotency-Key");
    expect(firstIdempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondIdempotencyKey).toBe(firstIdempotencyKey);
  }, 15_000);

  it("aligns a partial current month to the first visible date weekday", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/public/booking/options")) return jsonResponse(options);
      if (url.startsWith("/api/public/booking/availability")) {
        return jsonResponse({
          ...availability,
          days: [{ date: "2026-07-16", capReached: false, slots: ["10:00"] }],
        });
      }
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" initialServiceSlug="classic-massage" />);
    await user.click(await screen.findByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await chooseSpecialist(user);

    const firstVisibleDate = await screen.findByRole("button", { name: /16 July 2026, Limited/i });
    expect(Array.from(firstVisibleDate.parentElement?.children ?? []).indexOf(firstVisibleDate)).toBe(3);
  });

  it("shows one month at a time and navigates between available months", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/public/booking/options")) return jsonResponse(options);
      if (url.startsWith("/api/public/booking/availability")) {
        return jsonResponse({
          ...availability,
          days: [
            { date: "2026-07-20", capReached: false, slots: ["10:00"] },
            { date: "2026-08-03", capReached: false, slots: ["10:30"] },
          ],
        });
      }
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" initialServiceSlug="classic-massage" />);
    await user.click(await screen.findByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await chooseSpecialist(user);

    expect(await screen.findByRole("heading", { name: "July 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /20 July 2026/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /3 August 2026/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();

    const selectedDateButton = screen.getByRole("button", { name: /20 July 2026/i });
    await user.click(selectedDateButton);
    const selectedUrl = window.location.href;
    expect(selectedDateButton).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Available times: 20 July 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next month: August 2026" }));

    expect(screen.getByRole("heading", { name: "August 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3 August 2026/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /20 July 2026/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(window.location.href).toBe(selectedUrl);
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous month: July 2026" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Previous month: July 2026" }));
    expect(screen.getByRole("button", { name: /20 July 2026/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the selected date and returns to time choice after a 409 hold conflict", async () => {
    const requests: Array<{ body?: string; url: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ body: init?.body as string | undefined, url });
      if (url.startsWith("/api/public/booking/options")) return jsonResponse(options);
      if (url.startsWith("/api/public/booking/availability")) return jsonResponse(availability);
      if (url === "/api/public/booking/holds") return jsonResponse({ code: "slot_unavailable" }, 409);
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" initialServiceSlug="classic-massage" />);

    await user.click(await screen.findByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await chooseSpecialist(user);
    await user.click(await screen.findByRole("button", { name: /20 July 2026, Available/i }));
    await user.click(screen.getByRole("button", { name: "10:00" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This time was just taken");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /20 July 2026, Available/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();
    });
    expect(requests.find((request) => request.url.includes("/availability"))?.url).not.toContain("specialistId");
    expect(JSON.parse(requests.find((request) => request.url.endsWith("/holds"))?.body ?? "{}")).not.toHaveProperty(
      "specialistId",
    );
  });

  it("keeps the previous hold when replacing it with a conflicting time", async () => {
    let holdAttempts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/public/booking/options")) return jsonResponse(options);
      if (url.startsWith("/api/public/booking/availability")) return jsonResponse(availability);
      if (url === "/api/public/booking/holds") {
        holdAttempts += 1;
        if (holdAttempts === 1) {
          return jsonResponse({
            currency: "EUR",
            durationMinutes: 60,
            holdToken: "original-hold-token",
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            priceCents: 5000,
            selectionId: "11111111-1111-4111-8111-111111111111",
            selectionVersion: 1,
            specialistId: "specialist-natali",
            specialistName: "Natalia Petrova",
          }, 201);
        }
        return jsonResponse({ code: "slot_unavailable" }, 409);
      }
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" initialServiceSlug="classic-massage" />);
    await user.click(await screen.findByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await chooseSpecialist(user, "Natalia Petrova");
    await user.click(await screen.findByRole("button", { name: /20 July 2026, Available/i }));
    await user.click(screen.getByRole("button", { name: "10:00" }));
    await screen.findByRole("heading", { name: "Your contact details" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Choose a date and time" });
    await user.click(screen.getByRole("button", { name: "11:30" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This time was just taken");
    await user.click(screen.getByRole("button", { name: "10:00" }));
    expect(await screen.findByRole("heading", { name: "Your contact details" })).toBeInTheDocument();
    expect(holdAttempts).toBe(2);
  });

  it("recovers a hold created by the server when its response is lost", async () => {
    let optionsRequests = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/public/booking/options")) {
        optionsRequests += 1;
        if (optionsRequests === 1) return jsonResponse(options);
        return jsonResponse({
          ...options,
          activeHold: {
            currency: "EUR",
            date: "2026-07-20",
            durationMinutes: 60,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            holdToken: "restored-after-response-loss",
            priceVariantId: "variant-60",
            priceCents: 5000,
            selectionId: "11111111-1111-4111-8111-111111111111",
            selectionVersion: 1,
            serviceSlug: "classic-massage",
            specialistId: "specialist-natali",
            specialistName: "Natalia Petrova",
            time: "10:00",
          },
        });
      }
      if (url.startsWith("/api/public/booking/availability")) return jsonResponse(availability);
      if (url === "/api/public/booking/holds") throw new TypeError("Network response was lost");
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" initialServiceSlug="classic-massage" />);
    await user.click(await screen.findByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await chooseSpecialist(user, "Natalia Petrova");
    await user.click(await screen.findByRole("button", { name: /20 July 2026, Available/i }));
    await user.click(screen.getByRole("button", { name: "10:00" }));

    expect(await screen.findByRole("heading", { name: "Your contact details" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(optionsRequests).toBe(2);
  });

  it("restores an active hold after the page is loaded again", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/public/booking/options")) {
        return jsonResponse({
          ...options,
          activeHold: {
            currency: "EUR",
            date: "2026-07-20",
            durationMinutes: 60,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            holdToken: "restored-hold-token",
            priceVariantId: "variant-60",
            priceCents: 5000,
            selectionId: "11111111-1111-4111-8111-111111111111",
            selectionVersion: 1,
            serviceSlug: "classic-massage",
            specialistId: "specialist-natali",
            specialistName: "Natalia Petrova",
            time: "11:30",
          },
        });
      }
      return jsonResponse({}, 404);
    }));

    render(<PublicBookingFlow locale="en" />);

    const restoredHeading = await screen.findByRole("heading", { name: "Your contact details" });
    await waitFor(() => expect(restoredHeading).toHaveFocus());
    expect(screen.getByText("20 July 2026")).toBeInTheDocument();
    expect(screen.getByText("11:30")).toBeInTheDocument();
    expect(screen.getByText("Natalia Petrova")).toBeInTheDocument();
    expect(window.location.search).toContain("step=details");
  });

  it("restores a confirmed booking after the confirmation response is lost", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith("/api/public/booking/options")) {
        return jsonResponse({
          ...options,
          confirmation: {
            currency: "EUR",
            date: "2026-07-20",
            durationMinutes: 60,
            priceCents: 5000,
            priceVariantId: "variant-60",
            publicReference: "MMN-2026-RESTORED",
            serviceName: "Classic massage",
            serviceSlug: "classic-massage",
            specialistId: "specialist-natali",
            specialistName: "Natalia Petrova",
            status: "confirmed",
            time: "10:00",
          },
        });
      }
      return jsonResponse({}, 404);
    }));

    window.history.replaceState({}, "", "/en/booking?step=review");
    render(<PublicBookingFlow locale="en" />);

    const successHeading = await screen.findByRole("heading", { name: "Booking confirmed" });
    await waitFor(() => expect(successHeading).toHaveFocus());
    expect(screen.getByText("MMN-2026-RESTORED")).toBeInTheDocument();
    expect(screen.getByText("Natalia Petrova")).toBeInTheDocument();
    expect(screen.getByText(/60 min/)).toHaveTextContent(/€50\.00/);
    expect(requests[0]).toContain("recoverConfirmation=1");
  });

  it("validates contact name and phone before opening the review step", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/public/booking/options")) return jsonResponse(options);
      if (url.startsWith("/api/public/booking/availability")) return jsonResponse(availability);
      if (url === "/api/public/booking/holds") {
        return jsonResponse({
          currency: "EUR",
          durationMinutes: 60,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          holdToken: "hold-token",
          priceCents: 5000,
          selectionId: "11111111-1111-4111-8111-111111111111",
          selectionVersion: 1,
          specialistId: "specialist-natali",
          specialistName: "Natalia Petrova",
        }, 201);
      }
      return jsonResponse({}, 404);
    }));
    const user = userEvent.setup();

    render(<PublicBookingFlow locale="en" initialServiceSlug="classic-massage" />);
    await user.click(await screen.findByRole("radio", { name: /60 min/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await chooseSpecialist(user, "Natalia Petrova");
    await user.click(await screen.findByRole("button", { name: /20 July 2026, Available/i }));
    await user.click(screen.getByRole("button", { name: "10:00" }));
    await user.type(await screen.findByLabelText("Name"), "A");
    await user.type(screen.getAllByLabelText("Phone")[0], "123");
    await user.click(screen.getByRole("checkbox", { name: /privacy policy/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Enter a name with at least 2 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid phone number with 7-15 digits.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Review your booking" })).not.toBeInTheDocument();
  });
});
