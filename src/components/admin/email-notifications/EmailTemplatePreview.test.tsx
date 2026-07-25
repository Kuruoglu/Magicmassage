import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";
import { EmailTemplatePreview } from "./EmailTemplatePreview";

vi.mock("@/lib/supabase/browser", () => ({
  getAdminAuthorizationHeader: vi.fn(),
}));

function previewResponse(eventType: string, locale: string) {
  return new Response(JSON.stringify({
    preview: {
      html: `<!doctype html><html lang="${locale}"><body>${eventType}</body></html>`,
      subject: `Subject ${eventType} ${locale}`,
      templateVersion: 1,
      text: `Text ${eventType} ${locale}`,
    },
  }), { headers: { "Content-Type": "application/json" }, status: 200 });
}

describe("EmailTemplatePreview", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.mocked(getAdminAuthorizationHeader).mockResolvedValue("Bearer aal2-token");
  });

  it("shows subject, sandboxed HTML, and text from the protected renderer endpoint", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.com");
      return previewResponse(
        url.searchParams.get("eventType") ?? "",
        url.searchParams.get("locale") ?? "",
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailTemplatePreview />);

    expect(await screen.findByText("Subject booking_confirmed ru")).toBeVisible();
    expect(screen.getByText("Text booking_confirmed ru")).toBeVisible();
    const frame = screen.getByTitle("HTML-предпросмотр: Подтверждение записи");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("srcdoc", expect.stringContaining("booking_confirmed"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/email-template-preview?eventType=booking_confirmed&locale=ru",
      expect.objectContaining({ headers: { Authorization: "Bearer aal2-token" } }),
    );
  });

  it("updates the real preview when event and locale change", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.com");
      return previewResponse(
        url.searchParams.get("eventType") ?? "",
        url.searchParams.get("locale") ?? "",
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailTemplatePreview />);
    expect(await screen.findByText("Subject booking_confirmed ru")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Тип письма"), { target: { value: "booking_care" } });
    fireEvent.change(screen.getByLabelText("Язык письма"), { target: { value: "en" } });

    expect(await screen.findByText("Subject booking_care en")).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/email-template-preview?eventType=booking_care&locale=en",
      expect.any(Object),
    ));
  });

  it("does not call the endpoint outside an authenticated admin session", async () => {
    vi.mocked(getAdminAuthorizationHeader).mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailTemplatePreview />);

    expect(await screen.findByText(/admin-сессию/)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a late manual retry after the selected event changes", async () => {
    let resolveRetry: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveRetry = resolve;
      }))
      .mockImplementationOnce(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "https://example.com");
        return previewResponse(
          url.searchParams.get("eventType") ?? "",
          url.searchParams.get("locale") ?? "",
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<EmailTemplatePreview />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("Тип письма"), { target: { value: "booking_care" } });

    expect(await screen.findByText("Subject booking_care ru")).toBeVisible();
    resolveRetry?.(previewResponse("booking_confirmed", "ru"));

    await waitFor(() => {
      expect(screen.getByText("Subject booking_care ru")).toBeVisible();
      expect(screen.queryByText("Subject booking_confirmed ru")).not.toBeInTheDocument();
    });
  });
});
