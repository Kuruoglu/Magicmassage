import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomePageView } from "@/components/home-page-view";
import { PublicPageShell } from "@/components/public-page-shell";
import { getHomeContent } from "@/content/home";
import { getPublicShellRuntime } from "@/content/public-content-runtime";
import { isSupportedLocale, locales } from "@/i18n/config";
import { createPublicPageMetadata } from "@/seo/public-page-metadata";

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

  return createPublicPageMetadata(locale, "home");
}

export default async function LocalePage({ params }: LocalePageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const content = getHomeContent(locale);
  const shellRuntime = await getPublicShellRuntime(locale);

  return (
    <PublicPageShell locale={locale} currentPage="home" content={content} {...shellRuntime}>
      <HomePageView
        locale={locale}
        content={content}
        mediaPlacements={shellRuntime.mediaPlacements}
        publicBookingEnabled={shellRuntime.publicBookingEnabled}
        services={shellRuntime.services}
      />
    </PublicPageShell>
  );
}
