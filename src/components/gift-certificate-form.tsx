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
const nameMaxLength = 80;
const emailMaxLength = 254;
const messageMaxLength = 180;

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

const customAmountErrorId = "gift-custom-amount-error";

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
      {status === "success" ? (
        <p className="form-success" aria-live="polite">
          {content.paymentSuccess}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="form-error" aria-live="polite">
          {content.paymentError}
        </p>
      ) : null}
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
  const previewRecipientName =
    effectiveRecipientName.trim() ||
    (purchaseMode === "gift" ? content.recipientNameLabel : content.purchaserNameLabel);
  const selectedMassageLines = massageLines.map((line) => {
    const service = content.services.find((option) => option.slug === line.serviceSlug) ?? content.services[0];

    return {
      ...line,
      service,
      lineTotalEurCents: service.priceEur * line.sessions * 100,
    };
  });
  const hasInvalidAmountVoucher =
    amountVoucherEur !== undefined &&
    (!Number.isInteger(amountVoucherEur) ||
      amountVoucherEur < content.amountMinEur ||
      amountVoucherEur > content.amountMaxEur);
  const amountVoucherError = hasInvalidAmountVoucher
    ? `${content.customAmountLabel}: ${content.amountMinEur}-${content.amountMaxEur} EUR`
    : undefined;
  const isValid =
    purchaserName.trim().length >= 2 &&
    emailPattern.test(purchaserEmail.trim()) &&
    effectiveRecipientName.trim().length >= 2 &&
    total.totalEurCents > 0 &&
    !hasInvalidAmountVoucher &&
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
      <div className="gift-form-flow">
        <div className="gift-form-heading">
          <p className="eyebrow">Magic Massage Natali</p>
          <h2>{content.title}</h2>
          <p>{content.description}</p>
        </div>

        <section className="gift-form-step" data-testid="gift-form-step-recipient">
          <div className="gift-step-heading">
            <span className="gift-step-number">1</span>
            <div>
              <p>{content.title}</p>
              <h3>
                {content.selfModeLabel} / {content.giftModeLabel}
              </h3>
            </div>
          </div>

          <fieldset className="gift-choice-grid">
            <legend className="sr-only">{content.title}</legend>
            <label className={`gift-choice-card ${purchaseMode === "self" ? "is-selected" : ""}`}>
              <input
                className="sr-only"
                type="radio"
                name="purchaseMode"
                checked={purchaseMode === "self"}
                onChange={() => {
                  setPurchaseMode("self");
                  setDeliveryMode("buyer_only");
                  setSession(undefined);
                }}
              />
              <span className="gift-choice-mark" aria-hidden="true" />
              <strong>{content.selfModeLabel}</strong>
            </label>
            <label className={`gift-choice-card ${purchaseMode === "gift" ? "is-selected" : ""}`}>
              <input
                className="sr-only"
                type="radio"
                name="purchaseMode"
                checked={purchaseMode === "gift"}
                onChange={() => {
                  setPurchaseMode("gift");
                  setSession(undefined);
                }}
              />
              <span className="gift-choice-mark" aria-hidden="true" />
              <strong>{content.giftModeLabel}</strong>
            </label>
          </fieldset>

          <div className="gift-field-grid">
            <label className="gift-field">
              <span className="gift-field-label">{content.purchaserNameLabel}</span>
              <input
                name="purchaserName"
                value={purchaserName}
                maxLength={nameMaxLength}
                onChange={(event) => {
                  setPurchaserName(event.target.value);
                  setSession(undefined);
                }}
                autoComplete="name"
              />
            </label>
            <label className="gift-field">
              <span className="gift-field-label">{content.purchaserEmailLabel}</span>
              <input
                type="email"
                name="purchaserEmail"
                value={purchaserEmail}
                maxLength={emailMaxLength}
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
                <label className="gift-field">
                  <span className="gift-field-label">{content.recipientNameLabel}</span>
                  <input
                    name="recipientName"
                    value={recipientName}
                    maxLength={nameMaxLength}
                    onChange={(event) => {
                      setRecipientName(event.target.value);
                      setSession(undefined);
                    }}
                    autoComplete="name"
                  />
                </label>
                <label className="gift-field">
                  <span className="gift-field-label">{content.recipientMessageLabel}</span>
                  <input
                    name="recipientMessage"
                    value={recipientMessage}
                    maxLength={messageMaxLength}
                    onChange={(event) => {
                      setRecipientMessage(event.target.value);
                      setSession(undefined);
                    }}
                  />
                </label>
              </div>

              <fieldset className="gift-delivery-options">
                <legend className="sr-only">{content.deliverySectionLabel}</legend>
                <label className={deliveryMode === "buyer_only" ? "is-selected" : undefined}>
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
                <label className={deliveryMode === "recipient_email" ? "is-selected" : undefined}>
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
                <label className="gift-field gift-full-field">
                  <span className="gift-field-label">{content.recipientEmailLabel}</span>
                  <input
                    type="email"
                    name="recipientEmail"
                    value={recipientEmail}
                    maxLength={emailMaxLength}
                    onChange={(event) => {
                      setRecipientEmail(event.target.value);
                      setSession(undefined);
                    }}
                    autoComplete="email"
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="gift-form-step" data-testid="gift-form-step-contents">
          <div className="gift-step-heading">
            <span className="gift-step-number">2</span>
            <div>
              <p>{content.serviceLabel}</p>
              <h3>
                {content.serviceLabel} / {content.amountTitle}
              </h3>
            </div>
          </div>

          <div className="gift-line-items">
            {massageLines.map((line, index) => (
              <div className="gift-line-item" key={line.id}>
                <label className="gift-field">
                  <span className="gift-field-label">{content.serviceLabel}</span>
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
                <label className="gift-field gift-session-field">
                  <span className="gift-field-label">{content.sessionsLabel}</span>
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
                {index > 0 || amountVoucherEur !== undefined ? (
                  <button
                    className="gift-remove-button"
                    type="button"
                    onClick={() => removeMassageLine(line.id)}
                  >
                    {content.removeMassageAction}
                  </button>
                ) : null}
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
                  aria-pressed={amountVoucherEur === amount}
                  className={amountVoucherEur === amount ? "is-selected" : undefined}
                  onClick={() => setVoucherAmount(amount)}
                >
                  {amount} EUR
                </button>
              ))}
            </div>
            <label className="gift-field">
              <span className="gift-field-label">{content.customAmountLabel}</span>
              <input
                type="number"
                name="customAmountEur"
                inputMode="numeric"
                min={content.amountMinEur}
                max={content.amountMaxEur}
                step={1}
                aria-describedby={amountVoucherError ? customAmountErrorId : undefined}
                aria-invalid={hasInvalidAmountVoucher}
                value={amountVoucherEur ?? ""}
                onChange={(event) =>
                  setVoucherAmount(event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </label>
            {amountVoucherError ? (
              <p className="gift-field-error" id={customAmountErrorId} aria-live="polite">
                {amountVoucherError}
              </p>
            ) : null}
          </div>
        </section>

      </div>

      <aside className="gift-preview" data-testid="gift-certificate-preview" aria-label={content.title}>
        <div className="gift-preview-card">
          <div className="gift-preview-topline">
            <span>Magic Massage Natali</span>
            <span>EUR</span>
          </div>
          <h3>{content.title}</h3>
          <div className="gift-preview-recipient">
            <span>{purchaseMode === "gift" ? content.giftModeLabel : content.selfModeLabel}</span>
            <strong>{previewRecipientName}</strong>
          </div>
          <div className="gift-preview-lines">
            {selectedMassageLines.map((line) => (
              <div className="gift-preview-line" key={line.id}>
                <span>
                  {line.sessions} x {line.service.title}
                </span>
                <strong>{formatEur(line.lineTotalEurCents)}</strong>
              </div>
            ))}
            {amountVoucherEur ? (
              <div className="gift-preview-line">
                <span>{content.amountTitle}</span>
                <strong>{formatEur(amountVoucherEur * 100)}</strong>
              </div>
            ) : null}
          </div>
          <div className="gift-preview-total">
            <span>{content.totalLabel}</span>
            <strong>{formatEur(total.totalEurCents)}</strong>
          </div>
          {showBgn ? (
            <div className="gift-preview-bgn">
              <span>{content.bgnEquivalentLabel}</span>
              <strong>{bgnEquivalent.formatted}</strong>
            </div>
          ) : null}
          <p>
            {content.validityNotice} {content.validityConfirmationNotice}
          </p>
        </div>
      </aside>

      <section className="gift-form-step gift-payment-step">
        <div className="gift-step-heading">
          <span className="gift-step-number">3</span>
          <div>
            <p>{content.totalLabel}</p>
            <h3>{content.paymentSectionTitle}</h3>
          </div>
        </div>

        <fieldset className="gift-payment-section" aria-label={content.paymentSectionTitle}>
          <legend className="sr-only">{content.paymentSectionTitle}</legend>
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
          {paymentError ? (
            <p className="form-error" aria-live="polite">
              {paymentError}
            </p>
          ) : null}
        </fieldset>
      </section>
    </form>
  );
}
