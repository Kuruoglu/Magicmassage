import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getGiftCertificatesPageContent } from "@/content/gift-certificates-page";
import { GiftCertificateForm } from "./gift-certificate-form";

describe("GiftCertificateForm", () => {
  it("renders a structured checkout editor with a live certificate preview", () => {
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    const preview = screen.getByTestId("gift-certificate-preview");

    expect(screen.getByTestId("gift-form-step-recipient")).toHaveTextContent(
      content.form.selfModeLabel,
    );
    expect(screen.getByTestId("gift-form-step-contents")).toHaveTextContent(
      content.form.serviceLabel,
    );
    expect(preview).toHaveTextContent("Magic Massage Natali");
    expect(preview).toHaveTextContent(content.form.totalLabel);
    expect(preview).toHaveTextContent("45.00 EUR");
  });

  it("uses option-card selected states for self and gift modes", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    const selfRadio = screen.getByRole("radio", { name: content.form.selfModeLabel });
    const giftRadio = screen.getByRole("radio", { name: content.form.giftModeLabel });

    expect(selfRadio.closest("label")).toHaveClass("gift-choice-card", "is-selected");
    expect(giftRadio.closest("label")).toHaveClass("gift-choice-card");
    expect(giftRadio.closest("label")).not.toHaveClass("is-selected");

    await user.click(giftRadio);

    expect(selfRadio.closest("label")).not.toHaveClass("is-selected");
    expect(giftRadio.closest("label")).toHaveClass("is-selected");
  });

  it("adds and removes massage certificate positions", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    expect(screen.getAllByLabelText(content.form.serviceLabel)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: content.form.removeMassageAction })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: content.form.addMassageAction }));

    expect(screen.getAllByLabelText(content.form.serviceLabel)).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: content.form.removeMassageAction })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: content.form.removeMassageAction }));

    expect(screen.getAllByLabelText(content.form.serviceLabel)).toHaveLength(1);
  });

  it("allows creating an amount-only certificate after choosing a free amount", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    await user.click(screen.getByRole("button", { name: "50 EUR" }));
    await user.click(screen.getByRole("button", { name: content.form.removeMassageAction }));

    const preview = screen.getByTestId("gift-certificate-preview");

    expect(screen.queryByLabelText(content.form.serviceLabel)).not.toBeInTheDocument();
    expect(preview).toHaveTextContent(content.form.amountTitle);
    expect(preview).toHaveTextContent("50.00 EUR");
    expect(preview).not.toHaveTextContent("Classic massage");
  });

  it("exposes quick amount selected state and rejects out-of-range custom amounts", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    const quickAmount = screen.getByRole("button", { name: "50 EUR" });
    const paymentSection = screen.getByRole("group", { name: content.form.paymentSectionTitle });
    const submit = within(paymentSection).getByRole("button", { name: content.form.payAction });
    const customAmount = screen.getByLabelText(content.form.customAmountLabel);

    expect(quickAmount).toHaveAttribute("aria-pressed", "false");

    await user.click(quickAmount);

    expect(quickAmount).toHaveAttribute("aria-pressed", "true");

    await user.clear(customAmount);
    await user.type(customAmount, "20");
    await user.type(screen.getByLabelText(content.form.purchaserNameLabel), "Anna Buyer");
    await user.type(screen.getByLabelText(content.form.purchaserEmailLabel), "anna@example.com");

    expect(customAmount).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(`${content.form.customAmountLabel}: 50-500 EUR`)).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("rejects decimal custom amounts and constrains long personal fields", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    const paymentSection = screen.getByRole("group", { name: content.form.paymentSectionTitle });
    const submit = within(paymentSection).getByRole("button", { name: content.form.payAction });
    const customAmount = screen.getByLabelText(content.form.customAmountLabel);
    const purchaserName = screen.getByLabelText(content.form.purchaserNameLabel);
    const purchaserEmail = screen.getByLabelText(content.form.purchaserEmailLabel);

    expect(purchaserName).toHaveAttribute("maxLength", "80");
    expect(purchaserName).toHaveAttribute("name", "purchaserName");
    expect(purchaserEmail).toHaveAttribute("name", "purchaserEmail");
    expect(customAmount).toHaveAttribute("step", "1");

    await user.clear(customAmount);
    await user.type(customAmount, "50.5");
    await user.type(purchaserName, "Anna Buyer");
    await user.type(purchaserEmail, "anna@example.com");

    expect(customAmount).toHaveAttribute("aria-invalid", "true");
    expect(submit).toBeDisabled();
  });

  it("switches between self and gift modes", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    expect(screen.getByLabelText(content.form.purchaserNameLabel)).toBeInTheDocument();
    expect(screen.queryByLabelText(content.form.recipientMessageLabel)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: content.form.giftModeLabel }));

    expect(screen.getByLabelText(content.form.recipientNameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(content.form.recipientMessageLabel)).toBeInTheDocument();
  });

  it("shows recipient email only for automatic delivery", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    await user.click(screen.getByRole("radio", { name: content.form.giftModeLabel }));

    expect(screen.getByRole("group", { name: content.form.deliverySectionLabel })).toBeInTheDocument();
    expect(screen.queryByLabelText(content.form.recipientEmailLabel)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: content.form.deliveryRecipientEmailLabel }));

    expect(screen.getByLabelText(content.form.recipientEmailLabel)).toBeInTheDocument();
  });

  it("shows the Stripe privacy notice and disables payment until the form is valid", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    expect(screen.getByText(content.form.paymentPrivacyNotice)).toBeInTheDocument();

    const paymentSection = screen.getByRole("group", { name: content.form.paymentSectionTitle });
    const submit = within(paymentSection).getByRole("button", { name: content.form.payAction });

    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(content.form.purchaserNameLabel), "Anna Buyer");
    await user.type(screen.getByLabelText(content.form.purchaserEmailLabel), "anna@example.com");

    expect(submit).toBeEnabled();
  });
});
