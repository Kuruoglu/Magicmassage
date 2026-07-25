import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAuthorizationHeader } from "@/lib/supabase/browser";
import { GiftCertificateReconciliationList } from "./GiftCertificateReconciliationList";

vi.mock("@/lib/supabase/browser", () => ({
  getAdminAuthorizationHeader: vi.fn(),
}));

describe("GiftCertificateReconciliationList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAdminAuthorizationHeader).mockResolvedValue("Bearer aal2-token");
  });

  it("shows incomplete orders without exposing recipient PII and safely reconciles one", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        orders: [{
          amountEurCents: 4500,
          canReconcile: true,
          certificateCode: "MMN-GC-20260719-ABC123XY",
          createdAt: "2026-07-19T08:00:00.000Z",
          hasCertificate: false,
          hasPaymentReference: true,
          orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          reason: "certificate_missing",
          status: "pending",
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        certificateCode: "MMN-GC-20260719-ABC123XY",
        ok: true,
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<GiftCertificateReconciliationList role="owner" />);

    const section = await screen.findByRole("region", { name: "Требуют сверки" });
    expect(within(section).getByText("MMN-GC-20260719-ABC123XY")).toBeVisible();
    expect(within(section).getByText(/Требует сверки/)).toBeVisible();
    expect(section).not.toHaveTextContent("@");

    await user.click(within(section).getByRole("button", { name: "Проверить оплату и восстановить" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/gift-certificates/reconciliation",
      expect.objectContaining({
        body: JSON.stringify({ orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
        method: "POST",
      }),
    ));
    expect(await screen.findByRole("status")).toHaveTextContent("Оплата подтверждена");
    expect(screen.getByRole("link", { name: "Открыть восстановленный сертификат" })).toHaveAttribute(
      "href",
      "/admin?section=certificates&role=owner&certificate=MMN-GC-20260719-ABC123XY",
    );
  });

  it("keeps unverifiable legacy orders visible without an unsafe action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      orders: [{
        amountEurCents: 5000,
        canReconcile: false,
        certificateCode: "MMN-LEGACY-1",
        createdAt: "2026-07-01T08:00:00.000Z",
        hasCertificate: false,
        hasPaymentReference: false,
        orderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        reason: "legacy_order_requires_review",
        status: "paid",
      }],
    }), { status: 200 })));

    render(<GiftCertificateReconciliationList role="administrator" />);

    const section = await screen.findByRole("region", { name: "Требуют сверки" });
    expect(within(section).getByText("Только ручная сверка")).toBeVisible();
    expect(within(section).queryByRole("button", { name: "Проверить оплату и восстановить" })).not.toBeInTheDocument();
  });
});
