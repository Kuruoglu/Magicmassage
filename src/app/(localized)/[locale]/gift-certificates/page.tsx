import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GiftCertificatesPageView } from "@/components/gift-certificates-page-view";
import { getGiftCertificatesPageContent } from "@/content/gift-certificates-page";
import { getHomeContent } from "@/content/home";
import { isSupportedLocale, locales } from "@/i18n/config";
import { PublicPageShell } from "@/components/public-page-shell";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

type GiftCertificatesPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: GiftCertificatesPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createPublicPageMetadata(locale, "giftCertificates");
}

export default async function GiftCertificatesPage({ params }: GiftCertificatesPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <PublicPageShell
      locale={locale}
      currentPage="giftCertificates"
      content={getHomeContent(locale)}
    >
      <GiftCertificatesPageView
        locale={locale}
        content={getGiftCertificatesPageContent(locale)}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null}
      />
    </PublicPageShell>
  );
}
