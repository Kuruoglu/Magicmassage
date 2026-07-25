import { NextResponse } from "next/server";

import { createGiftCertificateOrderStore } from "@/gift-certificates/order-store";
import { getStripeClient } from "@/gift-certificates/stripe-client";
import { finalizePersistedGiftCertificatePayment } from "@/gift-certificates/webhook";
import {
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
  getBearerToken,
} from "@/lib/supabase/admin";

const orderIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReconciliationRow = {
  amount_eur_cents?: unknown;
  can_reconcile?: unknown;
  certificate_code?: unknown;
  created_at?: unknown;
  has_certificate?: unknown;
  has_payment_reference?: unknown;
  order_id?: unknown;
  order_status?: unknown;
  reconciliation_reason?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function normalizeRow(row: ReconciliationRow) {
  if (
    typeof row.order_id !== "string" ||
    typeof row.certificate_code !== "string" ||
    typeof row.amount_eur_cents !== "number" ||
    typeof row.order_status !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.reconciliation_reason !== "string"
  ) {
    return null;
  }

  return {
    amountEurCents: row.amount_eur_cents,
    canReconcile: row.can_reconcile === true,
    certificateCode: row.certificate_code,
    createdAt: row.created_at,
    hasCertificate: row.has_certificate === true,
    hasPaymentReference: row.has_payment_reference === true,
    orderId: row.order_id,
    reason: row.reconciliation_reason,
    status: row.order_status,
  };
}

async function authorize(request: Request) {
  const client = createSupabaseAdminClient();
  if (!client) return { ok: false, response: jsonError("Forbidden", 403) } as const;

  const authorization = await authorizeSupabaseAdminAccess(
    client,
    getBearerToken(request.headers.get("authorization")),
    { allowedRoles: ["owner", "administrator"] },
  );
  if (!authorization.ok) {
    return {
      ok: false,
      response: jsonError(authorization.message, authorization.statusCode),
    } as const;
  }

  return { authorization, client, ok: true } as const;
}

export async function GET(request: Request): Promise<NextResponse> {
  const access = await authorize(request);
  if (!access.ok) return access.response;

  const { data, error } = await access.client.rpc(
    "admin_list_gift_certificate_reconciliation",
    { p_actor_user_id: access.authorization.userId },
  ) as unknown as {
    data: ReconciliationRow[] | null;
    error: { message?: string } | null;
  };

  if (error) {
    console.error("Gift certificate reconciliation lookup failed", error.message ?? "Unknown error");
    return jsonError("Не удалось загрузить сертификаты для сверки.", 500);
  }

  return NextResponse.json({
    orders: (data ?? []).map(normalizeRow).filter((row) => row !== null),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const access = await authorize(request);
  if (!access.ok) return access.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Некорректный запрос.", 400);
  }

  const orderId = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).orderId
    : undefined;
  if (typeof orderId !== "string" || !orderIdPattern.test(orderId)) {
    return jsonError("Некорректный заказ сертификата.", 400);
  }

  const orderStore = createGiftCertificateOrderStore(access.client as never);
  const stripe = getStripeClient();
  if (!orderStore || !stripe) {
    return jsonError("Сверка оплаты временно недоступна.", 503);
  }

  try {
    const order = await orderStore.loadOrder(orderId);
    if (!order.paymentIntentId) {
      return jsonError("У заказа нет проверяемой ссылки на оплату.", 409);
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
    await finalizePersistedGiftCertificatePayment({
      actorUserId: access.authorization.userId,
      expectedLivemode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false,
      orderStore,
      paymentIntent,
    });

    return NextResponse.json({ certificateCode: order.certificateCode, ok: true });
  } catch (error) {
    console.error(
      "Gift certificate reconciliation failed",
      error instanceof Error ? error.message : "Unknown reconciliation error",
    );
    return jsonError("Оплата не подтверждена или заказ нельзя безопасно восстановить.", 409);
  }
}
