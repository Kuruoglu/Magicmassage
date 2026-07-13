import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPageView } from "@/components/legal-page-view";
import { PublicPageShell } from "@/components/public-page-shell";
import { getHomeContent } from "@/content/home";
import { getLegalPageContent } from "@/content/legal-pages";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

type CookiesPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: CookiesPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createPublicPageMetadata(locale, "cookies");
}

export default async function CookiesPage({ params }: CookiesPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <PublicPageShell locale={locale} currentPage="cookies" content={getHomeContent(locale)}>
      <LegalPageView content={getLegalPageContent(locale, "cookies")} />
    </PublicPageShell>
  );
}
