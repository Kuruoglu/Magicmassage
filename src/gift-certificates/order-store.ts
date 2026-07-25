import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateGiftCertificateOrderPayload } from "./validation";
import type {
  GiftCertificatePaymentMetadataOrder,
  GiftCertificatePersistedOrder,
} from "./types";

type RpcError = { message?: string } | null;
type RpcResult = { data?: unknown; error: RpcError };

export type GiftCertificateOrderRpcClient = {
  rpc(
    functionName: string,
    parameters: Record<string, unknown>,
  ): PromiseLike<RpcResult>;
};

export type CreatePendingGiftCertificateOrderInput = {
  certificateCode: string;
  idempotencyKey: string;
  order: GiftCertificatePaymentMetadataOrder;
  orderId: string;
};

export type MarkGiftCertificatePaidInput = {
  certificateCode: string;
  locale: GiftCertificatePaymentMetadataOrder["locale"];
  orderId: string;
  paymentIntentId: string;
  totalEurCents: number;
};

export type GiftCertificateOrderStore = {
  attachPaymentIntent(orderId: string, paymentIntentId: string): Promise<void>;
  createPendingOrder(
    input: CreatePendingGiftCertificateOrderInput,
  ): Promise<GiftCertificatePersistedOrder>;
  loadOrder(orderId: string): Promise<GiftCertificatePersistedOrder>;
  markPaidAndEnqueue(input: MarkGiftCertificatePaidInput): Promise<boolean>;
  reconcilePaidAndEnqueue(
    input: MarkGiftCertificatePaidInput & { actorUserId: string },
  ): Promise<boolean>;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    return asRecord(value[0]);
  }

  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function orderPayloadHash(order: GiftCertificatePaymentMetadataOrder): string {
  return createHash("sha256").update(JSON.stringify(order)).digest("hex");
}

function parsePersistedOrder(value: unknown): GiftCertificatePersistedOrder {
  const source = asRecord(value);
  const payload = source ? asRecord(source.order_payload) : undefined;
  const publicPayload = payload ? { ...payload } : undefined;
  if (publicPayload) {
    delete publicPayload.expiresOn;
    delete publicPayload.totalEurCents;
  }
  const validation = validateGiftCertificateOrderPayload(publicPayload);
  const expiresOn = source?.expires_on;
  const totalEurCents = source?.amount_eur_cents;
  const status = source?.status;

  if (
    !source ||
    !validation.success ||
    typeof source.id !== "string" ||
    typeof source.certificate_code !== "string" ||
    typeof expiresOn !== "string" ||
    !Number.isInteger(totalEurCents) ||
    (status !== "pending" &&
      status !== "paid" &&
      status !== "fulfilled" &&
      status !== "fulfillment_failed")
  ) {
    throw new Error("Gift certificate order storage returned invalid data.");
  }

  return {
    ...validation.data,
    amountVoucherEur: validation.data.amountVoucherEur,
    certificateCode: source.certificate_code,
    expiresOn,
    id: source.id,
    paymentIntentId:
      typeof source.payment_intent_id === "string" ? source.payment_intent_id : undefined,
    status,
    totalEurCents: totalEurCents as number,
  };
}

async function callRpc(
  client: GiftCertificateOrderRpcClient,
  functionName: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(functionName, parameters);

  if (error) {
    console.error(
      `Gift certificate RPC ${functionName} failed`,
      error.message ?? "Unknown persistence error",
    );
    throw new Error("Gift certificate order persistence failed.");
  }

  return data;
}

export function createGiftCertificateOrderStore(
  client = createSupabaseAdminClient() as unknown as GiftCertificateOrderRpcClient | null,
): GiftCertificateOrderStore | undefined {
  if (!client) {
    return undefined;
  }

  return {
    async createPendingOrder(input) {
      const data = await callRpc(client, "gift_create_pending_order", {
        p_certificate_code: input.certificateCode,
        p_idempotency_key: input.idempotencyKey,
        p_order_id: input.orderId,
        p_order_payload: input.order,
        p_payload_hash: orderPayloadHash(input.order),
      });

      return parsePersistedOrder(data);
    },

    async attachPaymentIntent(orderId, paymentIntentId) {
      await callRpc(client, "gift_attach_payment_intent", {
        p_order_id: orderId,
        p_payment_intent_id: paymentIntentId,
      });
    },

    async loadOrder(orderId) {
      const data = await callRpc(client, "gift_load_order_for_email", {
        p_order_id: orderId,
      });

      return parsePersistedOrder(data);
    },

    async markPaidAndEnqueue(input) {
      const data = asRecord(
        await callRpc(client, "gift_mark_paid_and_enqueue", {
          p_certificate_code: input.certificateCode,
          p_locale: input.locale,
          p_order_id: input.orderId,
          p_payment_intent_id: input.paymentIntentId,
          p_total_eur_cents: input.totalEurCents,
        }),
      );

      return data?.newly_paid === true;
    },

    async reconcilePaidAndEnqueue(input) {
      const data = asRecord(
        await callRpc(client, "admin_reconcile_gift_certificate_order", {
          p_actor_user_id: input.actorUserId,
          p_certificate_code: input.certificateCode,
          p_locale: input.locale,
          p_order_id: input.orderId,
          p_payment_intent_id: input.paymentIntentId,
          p_total_eur_cents: input.totalEurCents,
        }),
      );

      return data?.newly_paid === true;
    },
  };
}
