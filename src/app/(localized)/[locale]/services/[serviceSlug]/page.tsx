import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/public-page-shell";
import { ServiceDetailPageView } from "@/components/service-detail-page-view";
import {
  getPublicPagesContent,
  getServiceSlugs,
} from "@/content/public-pages";
import { getPublicShellRuntime, getRuntimeService, getRuntimeServiceData } from "@/content/public-content-runtime";
import { getHomeContent } from "@/content/home";
import { isSupportedLocale, locales } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { getServicePagePath } from "@/navigation/service-routes";

type ServicePageProps = {
  params: Promise<{ locale: string; serviceSlug: string }>;
};

const languageAlternates = {
  bg: "bg-BG",
  ru: "ru",
  ua: "uk-UA",
  en: "en",
} as const;

const titleSuffix: Record<Locale, string> = {
  bg: "в Бургас",
  ru: "в Бургасе",
  ua: "у Бургасі",
  en: "in Burgas",
};

const descriptionPrefix: Record<Locale, string> = {
  bg: "Описание, подход и записване за",
  ru: "Описание, подход и запись на",
  ua: "Опис, підхід і запис на",
  en: "Description, approach and booking for",
};

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    getServiceSlugs(locale).map((serviceSlug) => ({ locale, serviceSlug })),
  );
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { locale, serviceSlug } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  const [service, serviceData] = await Promise.all([
    getRuntimeService(locale, serviceSlug),
    getRuntimeServiceData(locale, serviceSlug),
  ]);

  if (!service) {
    return {};
  }

  const languages = Object.fromEntries(
    (Object.entries(languageAlternates) as Array<[Locale, string]>).map(
      ([item, language]) => [language, getServicePagePath(item, serviceSlug)],
    ),
  );
  const fallbackTitle = `${service.title} ${titleSuffix[locale]}`;
  const fallbackDescription = `${descriptionPrefix[locale]} ${service.title.toLowerCase()} в Magic Massage Natali. ${service.description}`;
  const title = serviceData?.seo.title || fallbackTitle;
  const description = serviceData?.seo.description || fallbackDescription;
  const robots = serviceData?.seo.robots ?? "index,follow";

  return {
    title,
    description,
    alternates: {
      canonical: serviceData?.seo.canonicalUrl || getServicePagePath(locale, serviceSlug),
      languages: {
        ...languages,
        "x-default": getServicePagePath("bg", serviceSlug),
      },
    },
    openGraph: {
      title: serviceData?.seo.ogTitle || `${title} | Magic Massage Natali`,
      description: serviceData?.seo.ogDescription || description,
      type: "website",
      locale: locale === "ua" ? "uk_UA" : locale === "bg" ? "bg_BG" : locale === "en" ? "en" : "ru_RU",
      images: [serviceData?.seo.ogImage?.url || service.image],
    },
    robots: {
      follow: robots.includes("follow") && !robots.includes("nofollow"),
      index: robots.includes("index") && !robots.includes("noindex"),
    },
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const { locale, serviceSlug } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const service = await getRuntimeService(locale, serviceSlug);

  if (!service) {
    notFound();
  }

  const publicContent = getPublicPagesContent(locale);
  const shellRuntime = await getPublicShellRuntime(locale);
  const localePaths = Object.fromEntries(
    locales.map((item) => [item, getServicePagePath(item, serviceSlug)]),
  );

  return (
    <PublicPageShell
      locale={locale}
      currentPage="services"
      content={getHomeContent(locale)}
      localePaths={localePaths}
      {...shellRuntime}
    >
      <ServiceDetailPageView
        locale={locale}
        service={service}
        bookingAction={publicContent.services.bookingAction}
      />
    </PublicPageShell>
  );
}
