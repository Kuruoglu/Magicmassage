import Link from "next/link";

import type { PublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";

type ContactsPageViewProps = {
  locale: Locale;
  content: PublicPagesContent["contacts"];
};

export function ContactsPageView({ content }: ContactsPageViewProps) {
  return (
    <main>
      <section className="page-hero section-pad">
        <p className="eyebrow eyebrow-light">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </section>

      <section className="contact-page section-pad">
        <div className="contact-panel">
          <dl>
            <div>
              <dt>{content.addressLabel}</dt>
              <dd>{content.address}</dd>
            </div>
            <div>
              <dt>{content.phoneLabel}</dt>
              <dd>
                <a href="tel:+359896778309">{content.phone}</a>
              </dd>
            </div>
            <div>
              <dt>{content.hoursLabel}</dt>
              <dd>{content.hours}</dd>
            </div>
          </dl>
          <Link className="button" href="tel:+359896778309">
            {content.callAction}
          </Link>
        </div>
        <div className="map-panel" aria-label={content.mapTitle}>
          <span aria-hidden="true">49</span>
          <h2>{content.mapTitle}</h2>
          <p>{content.mapDescription}</p>
        </div>
      </section>
    </main>
  );
}
