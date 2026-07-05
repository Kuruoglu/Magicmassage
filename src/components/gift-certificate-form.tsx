"use client";

import { PaymentElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";

import {
  calculateGiftCertificateTotal,
  convertEurCentsToBgn,
  isBgnEquivalentVisible,
  type GiftCertificateServiceSlug,
} from "@/content/gift-certificates";
import type { GiftCertificatesPageContent } from "@/content/gift-certificates-page";
import type { Locale } from "@/i18n/config";

type MassageLine = {
  id: string;
  serviceSlug: GiftCertificateServiceSlug;
  sessions: number;
};

type GiftCertificateFormProps = {
  locale: Locale;
  content: GiftCertificatesPageContent["form"];
  stripePublishableKey: string | null;
};

type PaymentSessionResponse = {
  mode: "demo" | "stripe";
  clientSecret: string | null;
  amountEurCents: number;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();

function getStripePromise(key: string): Promise<Stripe | null> {
  const cached = stripePromiseCache.get(key);

  if (cached) {
    return cached;
  }

  const promise = loadStripe(key);
  stripePromiseCache.set(key, promise);
  return promise;
}

function createLineId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `line-${Date.now()}-${Math.random()}`;
}

function formatEur(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function StripePaymentButton({
  content,
  disabled,
  successUrl,
}: {
  content: GiftCertificatesPageContent["form"];
  disabled: boolean;
  successUrl: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit() {
    if (!stripe || !elements) {
      return;
    }

    setStatus("submitting");
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: successUrl,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setStatus("error");
      return;
    }

    setStatus("success");
  }

  return (
    <>
      <button
        className="button gift-pay-button"
        type="button"
        disabled={disabled || !stripe || !elements || status === "submitting"}
        onClick={handleSubmit}
      >
        {status === "submitting" ? content.preparingPayment : content.payAction}
      </button>
      {status === "success" ? <p className="form-success">{content.paymentSuccess}</p> : null}
      {status === "error" ? <p className="form-error">{content.paymentError}</p> : null}
    </>
  );
}

export function GiftCertificateForm({
  locale,
  content,
  stripePublishableKey,
}: GiftCertificateFormProps) {
  const [purchaseMode, setPurchaseMode] = useState<"self" | "gift">("self");
  const [deliveryMode, setDeliveryMode] = useState<"buyer_only" | "recipient_email">("buyer_only");
  const [purchaserName, setPurchaserName] = useState("");
  const [purchaserEmail, setPurchaserEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientMessage, setRecipientMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [massageLines, setMassageLines] = useState<MassageLine[]>([
    {
      id: createLineId(),
      serviceSlug: content.services[0].slug,
      sessions: content.sessionOptions[0],
    },
  ]);
  const [amountVoucherEur, setAmountVoucherEur] = useState<number | undefined>();
  const [session, setSession] = useState<PaymentSessionResponse | undefined>();
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | undefined>();

  const total = calculateGiftCertificateTotal({
    serviceItems: massageLines.map((line) => ({
      serviceSlug: line.serviceSlug,
      sessions: line.sessions,
    })),
    amountVoucherEur,
  });
  const bgnEquivalent = convertEurCentsToBgn(total.totalEurCents);
  const showBgn = isBgnEquivalentVisible(new Date());
  const effectiveRecipientName = purchaseMode === "self" ? purchaserName : recipientName;
  const isValid =
    purchaserName.trim().length >= 2 &&
    emailPattern.test(purchaserEmail.trim()) &&
    effectiveRecipientName.trim().length >= 2 &&
    total.totalEurCents > 0 &&
    (purchaseMode === "self" ||
      deliveryMode === "buyer_only" ||
      emailPattern.test(recipientEmail.trim()));
  const stripePromise = useMemo(
    () => (stripePublishableKey ? getStripePromise(stripePublishableKey) : null),
    [stripePublishableKey],
  );
  const successUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/${locale}/gift-certificates?payment=success`;

  function updateMassageLine(id: string, patch: Partial<MassageLine>) {
    setSession(undefined);
    setMassageLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function removeMassageLine(id: string) {
    setSession(undefined);
    setMassageLines((current) => current.filter((line) => line.id !== id));
  }

  function addMassageLine() {
    setSession(undefined);
    setMassageLines((current) => [
      ...current,
      {
        id: createLineId(),
        serviceSlug: content.services[0].slug,
        sessions: content.sessionOptions[0],
      },
    ]);
  }

  function setVoucherAmount(amount: number | undefined) {
    setSession(undefined);
    setAmountVoucherEur(amount);
  }

  async function preparePayment() {
    if (!isValid || session?.clientSecret) {
      return;
    }

    if (!stripePublishableKey) {
      setSession({
        mode: "demo",
        clientSecret: null,
        amountEurCents: total.totalEurCents,
      });
      return;
    }

    setIsPreparingPayment(true);
    setPaymentError(undefined);

    try {
      const response = await fetch("/api/gift-certificates/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          purchaseMode,
          purchaserName,
          purchaserEmail,
          recipientName: effectiveRecipientName,
          recipientEmail: deliveryMode === "recipient_email" ? recipientEmail : undefined,
          recipientMessage: purchaseMode === "gift" ? recipientMessage : undefined,
          deliveryMode: purchaseMode === "self" ? "buyer_only" : deliveryMode,
          serviceItems: massageLines.map((line) => ({
            serviceSlug: line.serviceSlug,
            sessions: line.sessions,
          })),
          amountVoucherEur,
          clientTotalEurCents: total.totalEurCents,
        }),
      });

      if (!response.ok) {
        throw new Error("Payment session failed");
      }

      setSession((await response.json()) as PaymentSessionResponse);
    } catch {
      setPaymentError(content.paymentError);
    } finally {
      setIsPreparingPayment(false);
    }
  }

  return (
    <form className="gift-form" onSubmit={(event) => event.preventDefault()}>
      <div className="gift-form-heading">
        <p className="eyebrow">{content.paymentSectionTitle}</p>
        <h2>{content.title}</h2>
        <p>{content.description}</p>
      </div>

      <fieldset className="gift-segmented">
        <legend>{content.title}</legend>
        <label>
          <input
            type="radio"
            name="purchaseMode"
            checked={purchaseMode === "self"}
            onChange={() => {
              setPurchaseMode("self");
              setDeliveryMode("buyer_only");
              setSession(undefined);
            }}
          />
          <span>{content.selfModeLabel}</span>
        </label>
        <label>
          <input
            type="radio"
            name="purchaseMode"
            checked={purchaseMode === "gift"}
            onChange={() => {
              setPurchaseMode("gift");
              setSession(undefined);
            }}
          />
          <span>{content.giftModeLabel}</span>
        </label>
      </fieldset>

      <div className="gift-field-grid">
        <label>
          <span>{content.purchaserNameLabel}</span>
          <input
            value={purchaserName}
            onChange={(event) => {
              setPurchaserName(event.target.value);
              setSession(undefined);
            }}
            autoComplete="name"
          />
        </label>
        <label>
          <span>{content.purchaserEmailLabel}</span>
          <input
            type="email"
            value={purchaserEmail}
            onChange={(event) => {
              setPurchaserEmail(event.target.value);
              setSession(undefined);
            }}
            autoComplete="email"
          />
        </label>
      </div>

      {purchaseMode === "gift" ? (
        <>
          <div className="gift-field-grid">
            <label>
              <span>{content.recipientNameLabel}</span>
              <input
                value={recipientName}
                onChange={(event) => {
                  setRecipientName(event.target.value);
                  setSession(undefined);
                }}
              />
            </label>
            <label>
              <span>{content.recipientMessageLabel}</span>
              <input
                value={recipientMessage}
                maxLength={180}
                onChange={(event) => {
                  setRecipientMessage(event.target.value);
                  setSession(undefined);
                }}
              />
            </label>
          </div>

          <fieldset className="gift-delivery-options">
            <legend>{content.deliveryBuyerOnlyLabel}</legend>
            <label>
              <input
                type="radio"
                name="deliveryMode"
                checked={deliveryMode === "buyer_only"}
                onChange={() => {
                  setDeliveryMode("buyer_only");
                  setSession(undefined);
                }}
              />
              <span>{content.deliveryBuyerOnlyLabel}</span>
            </label>
            <label>
              <input
                type="radio"
                name="deliveryMode"
                checked={deliveryMode === "recipient_email"}
                onChange={() => {
                  setDeliveryMode("recipient_email");
                  setSession(undefined);
                }}
              />
              <span>{content.deliveryRecipientEmailLabel}</span>
            </label>
          </fieldset>

          {deliveryMode === "recipient_email" ? (
            <label className="gift-full-field">
              <span>{content.recipientEmailLabel}</span>
              <input
                type="email"
                value={recipientEmail}
                onChange={(event) => {
                  setRecipientEmail(event.target.value);
                  setSession(undefined);
                }}
              />
            </label>
          ) : null}
        </>
      ) : null}

      <div className="gift-line-items">
        {massageLines.map((line) => (
          <div className="gift-line-item" key={line.id}>
            <label>
              <span>{content.serviceLabel}</span>
              <select
                aria-label={content.serviceLabel}
                value={line.serviceSlug}
                onChange={(event) =>
                  updateMassageLine(line.id, {
                    serviceSlug: event.target.value as GiftCertificateServiceSlug,
                  })
                }
              >
                {content.services.map((service) => (
                  <option key={service.slug} value={service.slug}>
                    {service.title} - {service.priceEur} EUR
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{content.sessionsLabel}</span>
              <select
                aria-label={content.sessionsLabel}
                value={line.sessions}
                onChange={(event) =>
                  updateMassageLine(line.id, { sessions: Number(event.target.value) })
                }
              >
                {content.sessionOptions.map((sessions) => (
                  <option key={sessions} value={sessions}>
                    {sessions}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="gift-remove-button"
              type="button"
              onClick={() => removeMassageLine(line.id)}
            >
              {content.removeMassageAction}
            </button>
          </div>
        ))}
        <button className="gift-add-button" type="button" onClick={addMassageLine}>
          {content.addMassageAction}
        </button>
      </div>

      <div className="gift-amount-panel">
        <h3>{content.amountTitle}</h3>
        <div className="gift-quick-amounts">
          {content.quickAmountValuesEur.map((amount) => (
            <button
              key={amount}
              type="button"
              className={amountVoucherEur === amount ? "is-selected" : undefined}
              onClick={() => setVoucherAmount(amount)}
            >
              {amount} EUR
            </button>
          ))}
          <button type="button" onClick={() => setVoucherAmount(undefined)}>
            0 EUR
          </button>
        </div>
        <label>
          <span>{content.customAmountLabel}</span>
          <input
            type="number"
            min={content.amountMinEur}
            max={content.amountMaxEur}
            value={amountVoucherEur ?? ""}
            onChange={(event) =>
              setVoucherAmount(event.target.value ? Number(event.target.value) : undefined)
            }
          />
        </label>
      </div>

      <div className="gift-summary">
        <div>
          <span>{content.totalLabel}</span>
          <strong>{formatEur(total.totalEurCents)}</strong>
        </div>
        {showBgn ? (
          <div>
            <span>{content.bgnEquivalentLabel}</span>
            <strong>{bgnEquivalent.formatted}</strong>
          </div>
        ) : null}
        <p>
          {content.validityNotice} {content.validityConfirmationNotice}
        </p>
      </div>

      <fieldset className="gift-payment-section" aria-label={content.paymentSectionTitle}>
        <legend>{content.paymentSectionTitle}</legend>
        <p>{content.paymentPrivacyNotice}</p>
        {!stripePublishableKey || session?.mode === "demo" ? (
          <p className="gift-demo-notice">{content.demoPaymentNotice}</p>
        ) : null}

        {session?.clientSecret && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret: session.clientSecret }}>
            <PaymentElement className="gift-payment-element" />
            <StripePaymentButton content={content} disabled={!isValid} successUrl={successUrl} />
          </Elements>
        ) : (
          <button
            className="button gift-pay-button"
            type="button"
            disabled={!isValid || isPreparingPayment}
            onClick={preparePayment}
          >
            {isPreparingPayment ? content.preparingPayment : content.payAction}
          </button>
        )}
        {paymentError ? <p className="form-error">{paymentError}</p> : null}
      </fieldset>
    </form>
  );
}
