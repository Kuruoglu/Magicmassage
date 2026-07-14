import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BlogArticleView, createBlogPostMetadata, getBlogCopy } from "@/components/public-blog";
import { getRuntimeBlogPost } from "@/content/public-content-runtime";
import { isSupportedLocale } from "@/i18n/config";

type BlogPostPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export const revalidate = 300;

const getBlogPost = cache(getRuntimeBlogPost);

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  const post = await getBlogPost(locale, slug);

  if (!post) {
    return {
      title: getBlogCopy(locale).notFoundTitle,
      robots: { follow: false, index: false },
    };
  }

  return createBlogPostMetadata(locale, post);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const post = await getBlogPost(locale, slug);

  if (!post) {
    notFound();
  }

  return <BlogArticleView locale={locale} post={post} />;
}
