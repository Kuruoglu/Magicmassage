import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { getGiftCertificatesPageContent } from "@/content/gift-certificates-page";
import { GiftCertificateForm } from "./gift-certificate-form";

describe("GiftCertificateForm", () => {
  it("adds and removes massage certificate positions", async () => {
    const user = userEvent.setup();
    const content = getGiftCertificatesPageContent("en");

    render(<GiftCertificateForm locale="en" content={content.form} stripePublishableKey={null} />);

    expect(screen.getAllByLabelText(content.form.serviceLabel)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: content.form.addMassageAction }));

    expect(screen.getAllByLabelText(content.form.serviceLabel)).toHaveLength(2);

    await user.click(screen.getAllByRole("button", { name: content.form.removeMassageAction })[1]);

    expect(screen.getAllByLabelText(content.form.serviceLabel)).toHaveLength(1);
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
