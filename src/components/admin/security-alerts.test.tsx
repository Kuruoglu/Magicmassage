// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";
import { AdminSecurityAlerts } from "./security-alerts";

vi.mock("@/lib/supabase/browser", () => ({
  getAdminAuthorizationHeader: vi.fn(),
}));

describe("AdminSecurityAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminAuthorizationHeader).mockResolvedValue("Bearer aal2-token");
  });

  it("shows unresolved alerts and resolves one without exposing contact data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        alerts: [{
          actorName: "Yana",
          alertType: "bulk_contact_reveal",
          createdAt: "2026-07-16T12:00:00Z",
          eventCount: 20,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          severity: "warning",
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminSecurityAlerts enabled />);

    const alertRow = (await screen.findByText(/Yana: 20/)).closest("[data-security-alert-id]");

    expect(alertRow).toHaveAttribute(
      "data-security-alert-id",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(await screen.findByText("Yana: 20 просмотров контактов за короткий период.")).toBeVisible();
    expect(screen.queryByText(/@|\+359/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Просмотрено" }));

    await waitFor(() => {
      expect(screen.queryByText("Yana: 20 просмотров контактов за короткий период.")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/security-alerts", expect.objectContaining({
      body: JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      method: "PATCH",
    }));
  });

  it("does not request alerts for restricted roles or non-dashboard contexts", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<AdminSecurityAlerts enabled={false} />);

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
