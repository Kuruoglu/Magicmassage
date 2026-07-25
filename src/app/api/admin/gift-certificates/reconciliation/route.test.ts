// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeSupabaseAdminAccess } from "@/lib/supabase/admin";
import { finalizePersistedGiftCertificatePayment } from "@/gift-certificates/webhook";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  finalize: vi.fn(),
  loadOrder: vi.fn(),
  reconcilePaidAndEnqueue: vi.fn(),
  retrieve: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  authorizeSupabaseAdminAccess: vi.fn(),
  createSupabaseAdminClient: vi.fn(() => ({ rpc: mocks.rpc })),
  getBearerToken: vi.fn(() => "aal2-token"),
}));

vi.mock("@/gift-certificates/order-store", () => ({
  createGiftCertificateOrderStore: vi.fn(() => ({
    loadOrder: mocks.loadOrder,
    reconcilePaidAndEnqueue: mocks.reconcilePaidAndEnqueue,
  })),
}));

vi.mock("@/gift-certificates/stripe-client", () => ({
  getStripeClient: vi.fn(() => ({ paymentIntents: { retrieve: mocks.retrieve } })),
}));

vi.mock("@/gift-certificates/webhook", () => ({
  finalizePersistedGiftCertificatePayment: mocks.finalize,
}));

const actor = {
  mode: "supabase" as const,
  ok: true as const,
  role: "owner" as const,
  userId: "11111111-1111-4111-8111-111111111111",
};
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("admin gift certificate reconciliation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue(actor);
  });

  it("lists sanitized reconciliation rows for owner/admin only", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        amount_eur_cents: 4500,
        can_reconcile: true,
        certificate_code: "MMN-GC-20260719-ABC123XY",
        created_at: "2026-07-19T08:00:00.000Z",
        has_certificate: false,
        has_payment_reference: true,
        order_id: orderId,
        order_status: "pending",
        reconciliation_reason: "certificate_missing",
        purchaser_email: "must-not-leak@example.com",
      }],
      error: null,
    });

    const response = await GET(new Request(
      "https://example.com/api/admin/gift-certificates/reconciliation",
      { headers: { authorization: "Bearer aal2-token" } },
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orders).toEqual([expect.objectContaining({
      canReconcile: true,
      certificateCode: "MMN-GC-20260719-ABC123XY",
      orderId,
      reason: "certificate_missing",
    })]);
    expect(JSON.stringify(body)).not.toContain("must-not-leak@example.com");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_list_gift_certificate_reconciliation", {
      p_actor_user_id: actor.userId,
    });
    expect(authorizeSupabaseAdminAccess).toHaveBeenCalledWith(
      expect.anything(),
      "aal2-token",
      { allowedRoles: ["owner", "administrator"] },
    );
  });

  it("rejects roles outside owner and administrator before querying orders", async () => {
    vi.mocked(authorizeSupabaseAdminAccess).mockResolvedValue({
      message: "Forbidden",
      mode: "supabase",
      ok: false,
      statusCode: 403,
    });

    const response = await GET(new Request(
      "https://example.com/api/admin/gift-certificates/reconciliation",
      { headers: { authorization: "Bearer specialist-token" } },
    ));

    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rechecks Stripe and invokes only the audited idempotent fulfillment path", async () => {
    mocks.loadOrder.mockResolvedValue({
      certificateCode: "MMN-GC-20260719-ABC123XY",
      id: orderId,
      paymentIntentId: "pi_test_123",
    });
    const paymentIntent = {
      amount: 4500,
      currency: "eur",
      id: "pi_test_123",
      livemode: false,
      metadata: {},
      status: "succeeded",
    };
    mocks.retrieve.mockResolvedValue(paymentIntent);
    mocks.finalize.mockResolvedValue(false);

    const response = await POST(new Request(
      "https://example.com/api/admin/gift-certificates/reconciliation",
      {
        body: JSON.stringify({ orderId, recipientEmail: "attacker@example.com" }),
        headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
        method: "POST",
      },
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      certificateCode: "MMN-GC-20260719-ABC123XY",
      ok: true,
    });
    expect(mocks.retrieve).toHaveBeenCalledWith("pi_test_123");
    expect(finalizePersistedGiftCertificatePayment).toHaveBeenCalledWith({
      actorUserId: actor.userId,
      expectedLivemode: false,
      orderStore: expect.anything(),
      paymentIntent,
    });
    expect(mocks.reconcilePaidAndEnqueue).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.finalize.mock.calls)).not.toContain("attacker@example.com");
  });

  it("does not attempt fulfillment without a persisted PaymentIntent reference", async () => {
    mocks.loadOrder.mockResolvedValue({
      certificateCode: "MMN-GC-20260719-ABC123XY",
      id: orderId,
    });

    const response = await POST(new Request(
      "https://example.com/api/admin/gift-certificates/reconciliation",
      {
        body: JSON.stringify({ orderId }),
        headers: { authorization: "Bearer aal2-token", "content-type": "application/json" },
        method: "POST",
      },
    ));

    expect(response.status).toBe(409);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });
});
