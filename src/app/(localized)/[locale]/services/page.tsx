import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/public-page-shell";
import { ServicesPageView } from "@/components/services-page-view";
import { getHomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

type ServicesPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: ServicesPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createPublicPageMetadata(locale, "services");
}

export default async function ServicesPage({ params }: ServicesPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <PublicPageShell locale={locale} currentPage="services" content={getHomeContent(locale)}>
      <ServicesPageView locale={locale} content={getPublicPagesContent(locale).services} />
    </PublicPageShell>
  );
}
