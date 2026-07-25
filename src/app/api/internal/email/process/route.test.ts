// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { processEmailOutbox } from "@/email/outbox";
import { cleanupAbandonedGiftCertificateOrders } from "@/gift-certificates/cleanup";

import { POST } from "./route";

vi.mock("@/email/outbox", () => ({
  processEmailOutbox: vi.fn(async () => ({ cancelled: 0, claimed: 1, failed: 0, sent: 1 })),
}));
vi.mock("@/gift-certificates/cleanup", () => ({
  cleanupAbandonedGiftCertificateOrders: vi.fn(async () => ({
    cancelled: 0,
    claimed: 0,
    failed: 0,
    fulfilled: 0,
    redacted: 0,
  })),
}));

describe("internal email worker route", () => {
  beforeEach(() => {
    process.env.EMAIL_WORKER_SECRET = "worker-secret";
    vi.clearAllMocks();
  });

  it("requires an exact bearer secret", async () => {
    const unauthorized = await POST(new Request("https://example.com/api/internal/email/process", { method: "POST" }));
    expect(unauthorized.status).toBe(401);
    expect(processEmailOutbox).not.toHaveBeenCalled();
  });

  it("processes at most 25 notifications", async () => {
    const response = await POST(new Request("https://example.com/api/internal/email/process", {
      headers: { authorization: "Bearer worker-secret" }, method: "POST",
    }));
    expect(response.status).toBe(200);
    expect(processEmailOutbox).toHaveBeenCalledWith({ batchSize: 25 });
    expect(cleanupAbandonedGiftCertificateOrders).toHaveBeenCalledWith({ batchSize: 25 });
  });

  it("still runs gift cleanup when the email worker fails", async () => {
    vi.mocked(processEmailOutbox).mockRejectedValueOnce(new Error("email failed"));

    const response = await POST(new Request("https://example.com/api/internal/email/process", {
      headers: { authorization: "Bearer worker-secret" }, method: "POST",
    }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      emailError: "email_worker_failed",
      giftCleanup: { claimed: 0 },
    });
    expect(cleanupAbandonedGiftCertificateOrders).toHaveBeenCalledWith({ batchSize: 25 });
  });
});
