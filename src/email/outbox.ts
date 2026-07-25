import "server-only";

import { createGiftCertificateOrderStore } from "@/gift-certificates/order-store";
import {
  isGiftCertificateOutboxEventType,
  prepareGiftCertificateOutboxDelivery,
} from "@/gift-certificates/outbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { EmailSendError, sendEmailWithResend } from "./resend";
import { createEmailPreferenceToken } from "./preferences-token";
import { renderTransactionalEmail } from "./templates";
import { emailLocales, transactionalEmailEvents, type EmailNotification } from "./types";

type RpcResult = { data: unknown; error: { message?: string } | null };
type EmailRpcClient = {
  rpc(functionName: string, parameters: Record<string, unknown>): PromiseLike<RpcResult>;
};

type DeliveryContext = {
  bookingUrl?: string;
  publicBookingEnabled?: boolean;
  replyTo?: string;
  reviewUrl?: string;
  valid: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function absoluteSiteUrl(path: string, siteUrl: string | undefined) {
  if (!siteUrl) return undefined;
  try {
    const base = new URL(siteUrl);
    if (base.protocol !== "https:") return undefined;
    return new URL(path, base).toString();
  } catch {
    return undefined;
  }
}

function parseNotification(value: unknown): EmailNotification | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string"
    || typeof value.aggregate_id !== "string"
    || (value.aggregate_type !== "appointment" && value.aggregate_type !== "certificate")
    || typeof value.attempt_count !== "number"
    || typeof value.dedupe_key !== "string"
    || typeof value.due_at !== "string"
    || !transactionalEmailEvents.includes(value.event_type as EmailNotification["event_type"])
    || typeof value.lease_token !== "string"
    || !emailLocales.includes(value.locale as EmailNotification["locale"])
    || !isRecord(value.payload)
    || typeof value.recipient_email !== "string"
    || typeof value.template_key !== "string"
    || typeof value.template_version !== "number"
  ) return null;

  return value as EmailNotification;
}

async function rpc(client: EmailRpcClient, functionName: string, parameters: Record<string, unknown>) {
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) throw new Error(error.message ?? `${functionName}_failed`);
  return data;
}

async function failNotification(
  client: EmailRpcClient,
  notification: EmailNotification,
  error: unknown,
) {
  const retryable = error instanceof EmailSendError ? error.retryable : true;
  const summary = error instanceof Error ? error.message.slice(0, 500) : "email_delivery_failed";
  await rpc(client, "email_fail_notification", {
    p_error_summary: summary,
    p_lease_token: notification.lease_token,
    p_notification_id: notification.id,
    p_retryable: retryable,
  });
}

export async function processEmailOutbox(options: {
  batchSize?: number;
  env?: NodeJS.ProcessEnv;
  fetchEmail?: typeof fetch;
} = {}) {
  const env = options.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  const client = createSupabaseAdminClient() as unknown as EmailRpcClient | null;
  if (!client) throw new Error("email_worker_not_configured");
  await rpc(client, "email_cleanup_personal_data", {});
  if (!apiKey || !from) throw new Error("email_worker_not_configured");

  const claimed = await rpc(client, "email_claim_notifications", {
    p_batch_size: Math.min(Math.max(options.batchSize ?? 25, 1), 25),
    p_lease_seconds: 900,
  });
  const notifications = Array.isArray(claimed)
    ? claimed.map(parseNotification).filter((item): item is EmailNotification => item !== null)
    : [];
  const result = { cancelled: 0, failed: 0, sent: 0 };

  for (let offset = 0; offset < notifications.length; offset += 5) {
    await Promise.all(notifications.slice(offset, offset + 5).map(async (notification) => {
      try {
      const contextValue = await rpc(client, "email_prepare_claimed_notification", {
        p_lease_token: notification.lease_token,
        p_notification_id: notification.id,
      });
      const initialContext = isRecord(contextValue)
        ? contextValue as DeliveryContext
        : { valid: false };
      if (initialContext.valid !== true) {
        result.cancelled += 1;
        return;
      }

      if (
        notification.event_type === "booking_care"
        && (!createEmailPreferenceToken(notification.id, env)
          || !absoluteSiteUrl(`/${notification.locale}/email-preferences`, env.NEXT_PUBLIC_SITE_URL))
      ) {
        throw new EmailSendError("care_unsubscribe_not_configured", false);
      }

      let effectiveNotification = notification;
      let attachments: Array<{ content: string; filename: string }> | undefined;
      if (isGiftCertificateOutboxEventType(notification.event_type)) {
        const store = createGiftCertificateOrderStore(client as never);
        if (!store) throw new Error("gift_order_store_unavailable");
        const giftOrderId = typeof notification.payload.gift_order_id === "string"
          ? notification.payload.gift_order_id
          : "";
        if (!giftOrderId) throw new EmailSendError("gift_order_id_missing", false);
        if (notification.event_type === "owner_gift_purchase") {
          const order = await store.loadOrder(giftOrderId);
          effectiveNotification = {
            ...notification,
            payload: { ...notification.payload, certificateCode: order.certificateCode },
          };
        } else {
          const delivery = await prepareGiftCertificateOutboxDelivery({
            orderId: giftOrderId,
            store,
          });
          effectiveNotification = {
            ...notification,
            payload: {
              ...notification.payload,
              certificateCode: delivery.certificateCode,
              clientName: notification.event_type === "gift_buyer" ? delivery.order.purchaserName : undefined,
              recipientName: delivery.order.recipientName,
            },
          };
          attachments = [{
            content: Buffer.from(delivery.pdf.bytes).toString("base64"),
            filename: delivery.pdf.filename,
          }];
        }
      }

      const refreshedContextValue = await rpc(client, "email_prepare_claimed_notification", {
        p_lease_token: notification.lease_token,
        p_notification_id: notification.id,
      });
      const context = isRecord(refreshedContextValue)
        ? refreshedContextValue as DeliveryContext
        : { valid: false };
      if (context.valid !== true) {
        result.cancelled += 1;
        return;
      }

      effectiveNotification = {
        ...effectiveNotification,
        payload: {
          ...effectiveNotification.payload,
          bookingUrl: context.publicBookingEnabled === true && env.NEXT_PUBLIC_SITE_URL
            ? absoluteSiteUrl(`/${notification.locale}/booking`, env.NEXT_PUBLIC_SITE_URL)
            : context.bookingUrl,
          adminUrl: absoluteSiteUrl(
            typeof effectiveNotification.payload.adminPath === "string"
              ? effectiveNotification.payload.adminPath
              : "/admin?section=certificates",
            env.NEXT_PUBLIC_SITE_URL,
          ),
          reviewUrl: context.reviewUrl,
        },
      };
      const rendered = renderTransactionalEmail(effectiveNotification, {
        env,
        siteUrl: env.NEXT_PUBLIC_SITE_URL,
      });
      const providerMessageId = await sendEmailWithResend({
        ...rendered,
        attachments,
        from,
        idempotencyKey: `email-notification/${notification.id}`,
        replyTo: typeof context.replyTo === "string" ? context.replyTo : undefined,
        to: notification.recipient_email,
      }, apiKey, options.fetchEmail);

      const completed = await rpc(client, "email_complete_notification", {
        p_lease_token: notification.lease_token,
        p_notification_id: notification.id,
        p_provider_message_id: providerMessageId,
      });
      if (completed !== true) throw new EmailSendError("email_completion_lease_lost", true);
      result.sent += 1;
      } catch (error) {
        await failNotification(client, notification, error);
        result.failed += 1;
      }
    }));
  }

  return { claimed: notifications.length, ...result };
}
