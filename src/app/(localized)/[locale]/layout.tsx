import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fontVariables } from "@/app/fonts";
import { businessFacts } from "@/config/business";
import { getHtmlLanguage, isSupportedLocale } from "@/i18n/config";
import { siteUrl } from "@/seo/site-url";

import "../../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${businessFacts.name} | Burgas`,
    template: `%s | ${businessFacts.name}`,
  },
};

type LocalizedLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocalizedLayout({ children, params }: LocalizedLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <html lang={getHtmlLanguage(locale)} className={fontVariables} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
