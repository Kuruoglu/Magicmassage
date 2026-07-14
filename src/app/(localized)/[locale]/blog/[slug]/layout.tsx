import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/public-page-shell";
import { getBlogPostPath } from "@/components/public-blog";
import { getHomeContent } from "@/content/home";
import { getPublicShellRuntime, getRuntimeBlogPost } from "@/content/public-content-runtime";
import { isSupportedLocale, locales, type Locale } from "@/i18n/config";

type BlogPostLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default async function BlogPostLayout({ children, params }: BlogPostLayoutProps) {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const [shellRuntime, post] = await Promise.all([
    getPublicShellRuntime(locale),
    getRuntimeBlogPost(locale, slug),
  ]);
  const localePaths: Partial<Record<Locale, string>> = Object.fromEntries([
    ...Object.entries(post?.seo.hreflang ?? {}).filter(
      (entry): entry is [Locale, string] => locales.includes(entry[0] as Locale) && Boolean(entry[1]),
    ),
    [locale, getBlogPostPath(locale, slug)],
  ]);

  return (
    <PublicPageShell
      locale={locale}
      content={getHomeContent(locale)}
      localePaths={localePaths}
      {...shellRuntime}
    >
      {children}
    </PublicPageShell>
  );
}
