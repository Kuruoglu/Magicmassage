import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processEmailOutbox } from "@/email/outbox";
import { cleanupAbandonedGiftCertificateOrders } from "@/gift-certificates/cleanup";

function authorized(request: Request) {
  const expected = process.env.EMAIL_WORKER_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [emailResult, giftCleanupResult] = await Promise.allSettled([
    processEmailOutbox({ batchSize: 25 }),
    cleanupAbandonedGiftCertificateOrders({ batchSize: 25 }),
  ]);
  if (emailResult.status === "rejected") {
    console.error(
      "Email outbox worker failed",
      emailResult.reason instanceof Error ? emailResult.reason.message : "unknown_error",
    );
  }
  if (giftCleanupResult.status === "rejected") {
    console.error(
      "Gift certificate cleanup failed",
      giftCleanupResult.reason instanceof Error
        ? giftCleanupResult.reason.message
        : "unknown_error",
    );
  }
  const failed =
    emailResult.status === "rejected" || giftCleanupResult.status === "rejected";

  return NextResponse.json(
    {
      ...(emailResult.status === "fulfilled"
        ? emailResult.value
        : { emailError: "email_worker_failed" }),
      ...(giftCleanupResult.status === "fulfilled"
        ? { giftCleanup: giftCleanupResult.value }
        : { giftCleanupError: "gift_cleanup_failed" }),
    },
    { status: failed ? 503 : 200 },
  );
}
