import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPageView } from "@/components/legal-page-view";
import { PublicPageShell } from "@/components/public-page-shell";
import { getHomeContent } from "@/content/home";
import { getLegalPageContent } from "@/content/legal-pages";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

type TermsPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createPublicPageMetadata(locale, "terms");
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <PublicPageShell locale={locale} currentPage="terms" content={getHomeContent(locale)}>
      <LegalPageView content={getLegalPageContent(locale, "terms")} />
    </PublicPageShell>
  );
}
