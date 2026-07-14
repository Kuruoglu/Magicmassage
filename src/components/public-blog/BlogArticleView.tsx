import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { PublicBlogPost } from "@/lib/public-content";
import { getBlogCopy } from "./blog-copy";
import { formatBlogDate } from "./blog-format";
import { getBlogPath, getBlogPostPath } from "./blog-routes";
import { siteUrl } from "@/seo/site-url";
import styles from "./PublicBlog.module.css";

type BlogArticleViewProps = {
  locale: Locale;
  post: PublicBlogPost;
};

export function BlogArticleView({ locale, post }: BlogArticleViewProps) {
  const copy = getBlogCopy(locale);
  const canonicalPath = post.seo.canonicalUrl || getBlogPostPath(locale, post.slug);
  const canonicalUrl = canonicalPath.startsWith("http") ? canonicalPath : `${siteUrl}${canonicalPath}`;
  const articleImage = post.seo.ogImage ?? post.coverMedia;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    author: { "@type": "Person", name: post.author || "Natali" },
    dateModified: post.updatedAt,
    datePublished: post.publishedAt,
    headline: post.title,
    image: articleImage ? [articleImage.url] : undefined,
    inLanguage: locale === "ua" ? "uk-UA" : locale,
    mainEntityOfPage: canonicalUrl,
  };

  return (
    <main className={styles.article}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd).replace(/</g, "\\u003c") }}
      />
      <article>
        <header className={styles.articleHeader}>
          <Link className={styles.backLink} href={getBlogPath(locale)}>
            {copy.backToBlog}
          </Link>
          <p className={styles.eyebrow}>{post.category}</p>
          <h1>{post.title}</h1>
          <div className={styles.meta}>
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt, locale)}</time>
            {post.author ? <span>{copy.authorLabel}: {post.author}</span> : null}
          </div>
          {post.usedLocaleFallback ? <p className={styles.fallbackNotice}>{copy.fallbackNotice}</p> : null}
          {post.coverMedia ? (
            <div className={styles.coverWrap}>
              {/* Public media can come from the configured Supabase Storage host. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.articleCover}
                src={post.coverMedia.url}
                alt={post.coverMedia.altText || post.title}
                width={post.coverMedia.width ?? undefined}
                height={post.coverMedia.height ?? undefined}
              />
            </div>
          ) : null}
        </header>

        <div className={styles.articleBody}>
          {/* The server-only public content layer sanitizes this HTML before rendering. */}
          <div dangerouslySetInnerHTML={{ __html: post.html }} />
          {post.tags.length > 0 ? (
            <ul className={styles.tags} aria-label={copy.tagsLabel}>
              {post.tags.map((tag) => <li key={tag}>{tag}</li>)}
            </ul>
          ) : null}
          <footer className={styles.articleFooter}>
            <Link className={styles.backLink} href={getBlogPath(locale)}>
              {copy.backToBlog}
            </Link>
          </footer>
        </div>
      </article>
    </main>
  );
}
