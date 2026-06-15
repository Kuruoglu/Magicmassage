import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePageView } from "@/components/home-page-view";
import { getHomeContent } from "@/content/home";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createHomeMetadata } from "@/seo/home-metadata";

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  return createHomeMetadata(locale);
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return <HomePageView locale={locale} content={getHomeContent(locale)} />;
}
