import {
  giftCertificateSalesConfig,
  isGiftCertificateServiceSlug,
  type GiftCertificateServiceItem,
} from "@/content/gift-certificates";
import { isSupportedLocale } from "@/i18n/config";
import type {
  GiftCertificateDeliveryMode,
  GiftCertificatePurchaseMode,
  GiftCertificateValidationResult,
} from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxNameLength = 80;
const maxRecipientMessageLength = 180;
const maxServiceItems = 6;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(source: Record<string, unknown>, key: string): string | undefined {
  const value = readString(source, key);

  return value.length > 0 ? value : undefined;
}

function readPurchaseMode(value: string): GiftCertificatePurchaseMode | undefined {
  return value === "self" || value === "gift" ? value : undefined;
}

function readDeliveryMode(value: string): GiftCertificateDeliveryMode | undefined {
  return value === "buyer_only" || value === "recipient_email" ? value : undefined;
}

function readServiceItems(value: unknown, errors: string[]): GiftCertificateServiceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length > maxServiceItems) {
    errors.push(`Choose no more than ${maxServiceItems} massage lines.`);
  }

  return value.slice(0, maxServiceItems).flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      errors.push("Invalid massage item.");
      return [];
    }

    const serviceSlug = readString(record, "serviceSlug");
    const sessions = Number(record.sessions);

    if (!isGiftCertificateServiceSlug(serviceSlug)) {
      errors.push("Unknown massage selection.");
      return [];
    }

    if (!(giftCertificateSalesConfig.sessionOptions as readonly number[]).includes(sessions)) {
      errors.push("Invalid number of sessions.");
      return [];
    }

    return [{ serviceSlug, sessions }];
  });
}

function readAmountVoucherEur(value: unknown, errors: string[]): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const amount = Number(value);
  const { minEur, maxEur } = giftCertificateSalesConfig.amountVoucher;

  if (!Number.isInteger(amount) || amount < minEur || amount > maxEur) {
    errors.push(`Amount voucher must be between ${minEur} and ${maxEur} EUR.`);
    return undefined;
  }

  return amount;
}

export function validateGiftCertificateOrderPayload(
  payload: unknown,
): GiftCertificateValidationResult {
  const source = asRecord(payload);
  const errors: string[] = [];

  if (!source) {
    return { success: false, errors: ["Invalid request payload."] };
  }

  const locale = readString(source, "locale");
  const supportedLocale = isSupportedLocale(locale) ? locale : undefined;
  const purchaseMode = readPurchaseMode(readString(source, "purchaseMode"));
  const deliveryMode = readDeliveryMode(readString(source, "deliveryMode"));
  const purchaserName = readString(source, "purchaserName");
  const purchaserEmail = readString(source, "purchaserEmail").toLowerCase();
  const recipientName = readString(source, "recipientName");
  const recipientEmail = readOptionalString(source, "recipientEmail")?.toLowerCase();
  const recipientMessage = readOptionalString(source, "recipientMessage");
  const serviceItems = readServiceItems(source.serviceItems, errors);
  const amountVoucherEur = readAmountVoucherEur(source.amountVoucherEur, errors);

  if (!supportedLocale) {
    errors.push("Unsupported locale.");
  }

  if (!purchaseMode) {
    errors.push("Choose who the certificate is for.");
  }

  if (!deliveryMode) {
    errors.push("Choose certificate delivery.");
  }

  if (purchaserName.length < 2) {
    errors.push("Purchaser name is required.");
  }

  if (purchaserName.length > maxNameLength) {
    errors.push(`Purchaser name must be ${maxNameLength} characters or fewer.`);
  }

  if (!emailPattern.test(purchaserEmail)) {
    errors.push("Valid purchaser email is required.");
  }

  if (recipientName.length < 2) {
    errors.push("Recipient name is required.");
  }

  if (recipientName.length > maxNameLength) {
    errors.push(`Recipient name must be ${maxNameLength} characters or fewer.`);
  }

  if ((recipientMessage?.length ?? 0) > maxRecipientMessageLength) {
    errors.push(
      `Recipient message must be ${maxRecipientMessageLength} characters or fewer.`,
    );
  }

  if (purchaseMode === "self" && deliveryMode !== "buyer_only") {
    errors.push("Self purchases are sent to the purchaser.");
  }

  if (deliveryMode === "recipient_email") {
    if (!recipientEmail) {
      errors.push("Recipient email is required for automatic delivery.");
    } else if (!emailPattern.test(recipientEmail)) {
      errors.push("Valid recipient email is required.");
    }
  }

  if (serviceItems.length === 0 && amountVoucherEur === undefined) {
    errors.push("Choose at least one massage or amount.");
  }

  if (errors.length > 0) {
    return { success: false, errors: [...new Set(errors)] };
  }

  return {
    success: true,
    data: {
      locale: supportedLocale ?? "bg",
      purchaseMode: purchaseMode ?? "self",
      purchaserName,
      purchaserEmail,
      recipientName,
      recipientEmail,
      recipientMessage,
      deliveryMode: deliveryMode ?? "buyer_only",
      serviceItems,
      amountVoucherEur,
    },
  };
}

function randomCodeSuffix(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function createGiftCertificateCode(date: Date, entropy = randomCodeSuffix()): string {
  const normalizedEntropy = entropy
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
    .padEnd(8, "X");
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");

  return `MMN-GC-${datePart}-${normalizedEntropy}`;
}
