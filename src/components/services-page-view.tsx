import Image from "next/image";
import Link from "next/link";

import type { PublicPagesContent } from "@/content/public-pages";
import type { ServiceCategory } from "@/content/service-catalog";
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
  en: "More",
};

const categoryOrder: ServiceCategory[] = ["massage", "partial", "spa"];

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
          {categoryOrder.map((category) => {
            const services = content.items.filter((service) => service.category === category);

            return (
              <section className="catalog-group" key={category}>
                <h2>{content.categoryLabels[category]}</h2>
                <div className="catalog-grid">
                  {services.map((service) => (
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
                        <p>{content.categoryLabels[service.category]}</p>
                        <h3>{service.title}</h3>
                        <span>{service.description}</span>
                        <Link href={getServicePagePath(locale, service.slug)}>
                          {detailLinkLabels[locale]} <span aria-hidden="true">↗</span>
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </main>
  );
}
