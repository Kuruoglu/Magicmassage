import path from "node:path";
import pdfMake from "pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import { getGiftCertificateServiceDefinition } from "@/content/gift-certificates";
import type { GiftCertificateFulfillmentOrder } from "./types";

export type GiftCertificatePdf = {
  filename: string;
  bytes: Uint8Array;
  searchableText: string;
};

type GenerateGiftCertificatePdfInput = {
  certificateCode: string;
  order: GiftCertificateFulfillmentOrder;
};

const studioFacts = [
  "Magic Massage Natali",
  "Mesta Street 49, Burgas",
  "+359 89 677 8309",
];

function configurePdfFonts() {
  const root = process.cwd();
  const fontRoot = path.join(root, "node_modules/pdfmake/fonts");

  pdfMake.setFonts({
    Roboto: {
      normal: path.join(root, "node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf"),
      bold: path.join(root, "node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf"),
      italics: path.join(root, "node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf"),
      bolditalics: path.join(root, "node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf"),
    },
  });
  pdfMake.setLocalAccessPolicy((filePath) => filePath.startsWith(fontRoot));
  pdfMake.setUrlAccessPolicy(() => false);
}

function getServiceLine(order: GiftCertificateFulfillmentOrder): string[] {
  return order.serviceItems.map((item) => {
    const service = getGiftCertificateServiceDefinition(item.serviceSlug);
    const title = service?.titles[order.locale] ?? item.serviceSlug;

    return `${title} x ${item.sessions}`;
  });
}

function buildSearchableText(certificateCode: string, order: GiftCertificateFulfillmentOrder) {
  return [
    "Gift certificate",
    certificateCode,
    order.recipientName,
    order.recipientMessage,
    ...getServiceLine(order),
    order.amountVoucherEur === undefined ? undefined : `${order.amountVoucherEur} EUR`,
    order.expiresOn,
    "By appointment",
    ...studioFacts,
  ]
    .filter(Boolean)
    .join("\n");
}

function createDocumentDefinition(
  certificateCode: string,
  order: GiftCertificateFulfillmentOrder,
): TDocumentDefinitions {
  const serviceLines = getServiceLine(order);
  const contentLines: Content[] = [
    { text: "Gift certificate", style: "eyebrow" },
    { text: "Magic Massage Natali", style: "title" },
    { text: certificateCode, style: "code" },
    { text: `Recipient: ${order.recipientName}`, margin: [0, 18, 0, 0] },
  ];

  if (order.recipientMessage) {
    contentLines.push({
      text: `Message: ${order.recipientMessage}`,
      italics: true,
      margin: [0, 8, 0, 0],
    });
  }

  contentLines.push(
    { text: "Included:", style: "sectionTitle" },
    serviceLines.length > 0
      ? { ul: serviceLines }
      : { text: "No fixed massage sessions selected." },
  );

  if (order.amountVoucherEur !== undefined) {
    contentLines.push({
      text: `Amount voucher: ${order.amountVoucherEur} EUR`,
      margin: [0, 8, 0, 0],
    });
  }

  contentLines.push(
    { text: `Valid until: ${order.expiresOn}`, style: "sectionTitle" },
    {
      text: "Booking is by prior arrangement. Redemption v1 is manual by certificate code.",
      margin: [0, 8, 0, 0],
    },
    { text: studioFacts.join("\n"), margin: [0, 28, 0, 0] },
  );

  return {
    pageSize: "A4",
    pageMargins: [56, 56, 56, 56],
    defaultStyle: {
      font: "Roboto",
      fontSize: 12,
      lineHeight: 1.35,
    },
    content: contentLines,
    styles: {
      eyebrow: {
        color: "#8D5AAE",
        bold: true,
        fontSize: 11,
        characterSpacing: 1.2,
      },
      title: {
        color: "#111111",
        bold: true,
        fontSize: 28,
        margin: [0, 8, 0, 12],
      },
      code: {
        color: "#6E4A8B",
        bold: true,
        fontSize: 18,
        margin: [0, 8, 0, 18],
      },
      sectionTitle: {
        bold: true,
        margin: [0, 20, 0, 8],
      },
    },
  };
}

async function getPdfBuffer(definition: TDocumentDefinitions): Promise<Buffer> {
  const buffer = await pdfMake.createPdf(definition).getBuffer();

  return Buffer.from(buffer);
}

export async function generateGiftCertificatePdf({
  certificateCode,
  order,
}: GenerateGiftCertificatePdfInput): Promise<GiftCertificatePdf> {
  configurePdfFonts();

  const bytes = await getPdfBuffer(createDocumentDefinition(certificateCode, order));

  return {
    filename: `${certificateCode}.pdf`,
    bytes,
    searchableText: buildSearchableText(certificateCode, order),
  };
}
