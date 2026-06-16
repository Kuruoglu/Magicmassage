import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AboutPageView } from "@/components/about-page-view";
import { PublicPageShell } from "@/components/public-page-shell";
import { getHomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

type AboutPageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createPublicPageMetadata(locale, "about");
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return (
    <PublicPageShell locale={locale} currentPage="about" content={getHomeContent(locale)}>
      <AboutPageView locale={locale} content={getPublicPagesContent(locale).about} />
    </PublicPageShell>
  );
}
