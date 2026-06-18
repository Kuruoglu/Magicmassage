import Image from "next/image";
import Link from "next/link";

import type { PublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";
import { getServicePagePath } from "@/navigation/service-routes";

type ServicesPageViewProps = {
  locale: Locale;
  content: PublicPagesContent["services"];
};

const detailLinkLabels: Record<Locale, string> = {
  bg: "Повече",
  ru: "Подробнее",
  ua: "Докладніше",
};

export function ServicesPageView({ locale, content }: ServicesPageViewProps) {
  return (
    <main>
      <section className="page-hero section-pad">
        <div className="section-inner">
          <p className="eyebrow eyebrow-light">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </section>

      <section className="catalog-section section-pad">
        <div className="section-inner">
          <div className="catalog-grid">
            {content.items.map((service) => (
              <article className="catalog-card" key={service.slug}>
                <div className="catalog-image">
                  <Image
                    src={service.image}
                    alt={service.imageAlt}
                    fill
                    sizes="(max-width: 760px) 92vw, 28vw"
                  />
                </div>
                <div className="catalog-copy">
                  <p>{service.slug.replaceAll("-", " ")}</p>
                  <h2>{service.title}</h2>
                  <span>{service.description}</span>
                  <Link href={getServicePagePath(locale, service.slug)}>
                    {detailLinkLabels[locale]} <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
