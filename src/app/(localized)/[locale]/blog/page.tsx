import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPageShell } from "@/components/public-page-shell";
import { BlogIndexView, createBlogIndexMetadata, getBlogCopy, getBlogPath } from "@/components/public-blog";
import { getHomeContent } from "@/content/home";
import { getPublicShellRuntime, getRuntimeBlogPosts } from "@/content/public-content-runtime";
import { isSupportedLocale, locales } from "@/i18n/config";

type BlogPageProps = {
  params: Promise<{ locale: string }>;
};

export const revalidate = 300;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) return {};

  const shellRuntime = await getPublicShellRuntime(locale);

  return shellRuntime.blogEnabled
    ? createBlogIndexMetadata(locale)
    : { robots: { follow: false, index: false }, title: getBlogCopy(locale).blogTitle };
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const [posts, shellRuntime] = await Promise.all([
    getRuntimeBlogPosts(locale),
    getPublicShellRuntime(locale),
  ]);
  const localePaths = Object.fromEntries(locales.map((item) => [item, getBlogPath(item)]));

  if (!shellRuntime.blogEnabled) {
    notFound();
  }

  return (
    <PublicPageShell
      currentPage="blog"
      locale={locale}
      content={getHomeContent(locale)}
      localePaths={localePaths}
      {...shellRuntime}
    >
      <BlogIndexView locale={locale} mediaPlacements={shellRuntime.mediaPlacements} posts={posts} />
    </PublicPageShell>
  );
}
