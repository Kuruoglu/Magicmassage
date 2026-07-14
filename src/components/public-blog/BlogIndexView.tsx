import Image from "next/image";
import Link from "next/link";

import type { Locale } from "@/i18n/config";
import type { PublicBlogPostSummary } from "@/lib/public-content";
import type { PublicMediaPlacement } from "@/lib/public-content";
import { resolvePublicMediaPlacement } from "@/lib/media-placement";
import { getBlogCopy } from "./blog-copy";
import { formatBlogDate } from "./blog-format";
import { getBlogPostPath } from "./blog-routes";
import styles from "./PublicBlog.module.css";

type BlogIndexViewProps = {
  locale: Locale;
  mediaPlacements?: PublicMediaPlacement[];
  posts: PublicBlogPostSummary[];
};

export function BlogIndexView({ locale, mediaPlacements, posts }: BlogIndexViewProps) {
  const copy = getBlogCopy(locale);
  const heroMedia = resolvePublicMediaPlacement(mediaPlacements, "blog.hero", locale);

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="blog-title">
        <Image
          className={styles.heroImage}
          src={heroMedia?.url ?? "/media/hero/hero-massage-session.jpg"}
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 id="blog-title">{copy.blogTitle}</h1>
          <p className={styles.heroDescription}>{copy.intro}</p>
        </div>
      </section>

      <section className={styles.feed} aria-labelledby="blog-feed-title">
        <h2 className={styles.feedHeading} id="blog-feed-title">
          {copy.blogTitle}
        </h2>
        {posts.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <h2>{copy.emptyTitle}</h2>
            <p>{copy.emptyDescription}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {posts.map((post) => {
              const href = getBlogPostPath(locale, post.slug);

              return (
                <article className={styles.card} key={post.id}>
                  {post.coverMedia ? (
                    <div className={styles.cardImageWrap}>
                      {/* Public media can come from the configured Supabase Storage host. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={styles.cardImage}
                        src={post.coverMedia.url}
                        alt={post.coverMedia.altText || post.title}
                        width={post.coverMedia.width ?? undefined}
                        height={post.coverMedia.height ?? undefined}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <div className={styles.cardBody}>
                    <div className={styles.meta}>
                      <span className={styles.category}>{post.category}</span>
                      <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt, locale)}</time>
                    </div>
                    <h2>
                      <Link href={href}>{post.title}</Link>
                    </h2>
                    {post.seo.description ? <p className={styles.summary}>{post.seo.description}</p> : null}
                    {post.usedLocaleFallback ? <p className={styles.fallbackNotice}>{copy.fallbackNotice}</p> : null}
                    <Link className={styles.readLink} href={href} aria-label={`${copy.readArticle}: ${post.title}`}>
                      {copy.readArticle}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
