import type { Metadata } from "next";
import { Lora, Montserrat } from "next/font/google";
import { notFound } from "next/navigation";

import { getHtmlLanguage, isSupportedLocale } from "@/i18n/config";

import "../../globals.css";

const sans = Montserrat({
  variable: "--font-sans",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const serif = Lora({
  variable: "--font-serif",
  weight: ["500", "600"],
  subsets: ["cyrillic", "latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Magic Massage Natali | Burgas",
    template: "%s | Magic Massage Natali",
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
    <html lang={getHtmlLanguage(locale)} className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
