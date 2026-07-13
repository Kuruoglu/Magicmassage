import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPageView } from "@/components/legal-page-view";
import { getHomeContent } from "@/content/home";
import { getLegalPageContent } from "@/content/legal-pages";
import { PublicPageShell } from "@/components/public-page-shell";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

type PrivacyPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createPublicPageMetadata(locale, "privacy");
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <PublicPageShell locale={locale} currentPage="privacy" content={getHomeContent(locale)}>
      <LegalPageView content={getLegalPageContent(locale, "privacy")} />
    </PublicPageShell>
  );
}
