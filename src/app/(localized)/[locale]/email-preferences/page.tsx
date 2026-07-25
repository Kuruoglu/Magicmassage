import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/public-page-shell";
import { getHomeContent } from "@/content/home";
import { getPublicShellRuntime } from "@/content/public-content-runtime";
import { isSupportedLocale, locales, type Locale } from "@/i18n/config";

import styles from "./EmailPreferences.module.css";
import { EmailPreferencesForm } from "./EmailPreferencesForm";

type EmailPreferencesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

const titles: Record<Locale, string> = {
  bg: "Настройки за имейли",
  ru: "Настройки email",
  ua: "Налаштування email",
  en: "Email preferences",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: EmailPreferencesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) return {};

  return {
    title: titles[locale],
    robots: { follow: false, index: false },
  };
}

export default async function EmailPreferencesPage({ params, searchParams }: EmailPreferencesPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) notFound();

  const rawToken = (await searchParams).token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  const shellRuntime = await getPublicShellRuntime(locale);
  const localePaths = Object.fromEntries(
    locales.map((item) => [
      item,
      `/${item}/email-preferences${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    ]),
  );

  return (
    <PublicPageShell locale={locale} content={getHomeContent(locale)} localePaths={localePaths} {...shellRuntime}>
      <main className={styles.workspace}>
        <EmailPreferencesForm locale={locale} token={token} />
      </main>
    </PublicPageShell>
  );
}
