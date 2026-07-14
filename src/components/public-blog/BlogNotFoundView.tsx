"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { isSupportedLocale, type Locale } from "@/i18n/config";
import { getBlogCopy } from "./blog-copy";
import { getBlogPath } from "./blog-routes";
import styles from "./PublicBlog.module.css";

export function BlogNotFoundView() {
  const params = useParams<{ locale?: string }>();
  const locale: Locale = params.locale && isSupportedLocale(params.locale) ? params.locale : "en";
  const copy = getBlogCopy(locale);

  return (
    <main className={styles.main}>
      <section className={styles.notFound} aria-labelledby="blog-not-found-title">
        <p className={styles.eyebrow}>{copy.blogTitle}</p>
        <h1 id="blog-not-found-title">{copy.notFoundTitle}</h1>
        <p>{copy.notFoundDescription}</p>
        <Link className={styles.backLink} href={getBlogPath(locale)}>
          {copy.backToBlog}
        </Link>
      </section>
    </main>
  );
}
