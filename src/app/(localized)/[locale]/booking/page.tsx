import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBookingFlow } from "@/components/public-booking/PublicBookingFlow";
import { PublicPageShell } from "@/components/public-page-shell";
import { getHomeContent } from "@/content/home";
import { getPublicShellRuntime } from "@/content/public-content-runtime";
import { getHtmlLanguage, isSupportedLocale, locales, type Locale } from "@/i18n/config";
import { getPublicBookingPath } from "@/navigation/public-routes";

type BookingPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string | string[] }>;
};

const metadataByLocale: Record<Locale, { description: string; title: string }> = {
  bg: {
    title: "Запазване на час",
    description: "Изберете масаж, продължителност, дата и свободен час в Magic Massage Natali.",
  },
  ru: {
    title: "Запись на массаж",
    description: "Выберите массаж, продолжительность, дату и свободное время в Magic Massage Natali.",
  },
  ua: {
    title: "Запис на масаж",
    description: "Оберіть масаж, тривалість, дату й вільний час у Magic Massage Natali.",
  },
  en: {
    title: "Book an appointment",
    description: "Choose a massage, duration, date and available time at Magic Massage Natali.",
  },
};

function safeServiceSlug(value: string | string[] | undefined) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ? value
    : undefined;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};

  const metadata = metadataByLocale[locale];
  const languageAlternates = Object.fromEntries(
    locales.map((item) => [getHtmlLanguage(item), getPublicBookingPath(item)]),
  );
  return {
    title: metadata.title,
    description: metadata.description,
    robots: { follow: true, index: true },
    alternates: {
      canonical: getPublicBookingPath(locale),
      languages: {
        ...languageAlternates,
        "x-default": getPublicBookingPath("bg"),
      },
    },
  };
}

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const shellRuntime = await getPublicShellRuntime(locale);
  if (!shellRuntime.publicBookingEnabled) notFound();

  const serviceSlug = safeServiceSlug((await searchParams).service);
  const localePaths = Object.fromEntries(
    locales.map((item) => [item, getPublicBookingPath(item, serviceSlug)]),
  );

  return (
    <PublicPageShell
      allowStickyContent
      locale={locale}
      content={getHomeContent(locale)}
      localePaths={localePaths}
      {...shellRuntime}
    >
      <PublicBookingFlow locale={locale} initialServiceSlug={serviceSlug} />
    </PublicPageShell>
  );
}
