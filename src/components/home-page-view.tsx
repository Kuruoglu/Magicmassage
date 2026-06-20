import Image from "next/image";
import Link from "next/link";

import { externalBookingLinkProps } from "@/config/booking";
import type { HomeContent } from "@/content/home";
import type { Locale } from "@/i18n/config";
import { createLocalBusinessJsonLd } from "@/seo/local-business-json-ld";

type HomePageViewProps = {
  locale: Locale;
  content: HomeContent;
};

function TrustIcon({ type }: { type: HomeContent["trust"][number]["icon"] }) {
  if (type === "access") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 7v7M24 34v7M8 24h7M33 24h7" />
        <path d="M15.5 15.5l5 5M32.5 15.5l-5 5M15.5 32.5l5-5M32.5 32.5l-5-5" />
        <circle cx="24" cy="24" r="7" />
      </svg>
    );
  }

  if (type === "variations") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M12 30c8-1 12-7 12-18 0 11 4 17 12 18" />
        <path d="M10 36c8-1 13-5 14-13 1 8 6 12 14 13" />
        <path d="M24 12v28" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M16 25c0-6 4-10 8-10s8 4 8 10" />
      <path d="M13 36c3-7 6-10 11-10s8 3 11 10" />
      <path d="M18 12l6-5 6 5" />
      <path d="M19 41h10" />
    </svg>
  );
}

export function HomePageView({ locale, content }: HomePageViewProps) {
  const base = `/${locale}`;
  const localBusinessJsonLd = createLocalBusinessJsonLd(locale, content);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main>
        <section className="hero hero-with-background" data-testid="home-hero">
          <Image
            className="hero-background"
            src="/media/hero/hero-massage-session.jpg"
            alt=""
            fill
            sizes="100vw"
            priority
          />
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-content section-pad">
            <div className="hero-copy">
              <p className="eyebrow eyebrow-light">{content.hero.eyebrow}</p>
              <h1>{content.hero.title}</h1>
              <p className="hero-description">{content.hero.description}</p>
              <div className="button-row">
                <a className="button" {...externalBookingLinkProps}>
                  {content.hero.primaryAction}
                </a>
                <Link className="text-link text-link-light" href={`${base}/services`}>
                  {content.hero.secondaryAction}
                  <span aria-hidden="true"> →</span>
                </Link>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-frame">
                <Image
                  src="/media/about/natali-at-work.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 980px) 80vw, 34vw"
                  priority
                />
              </div>
              <div className="hero-floating-card hero-floating-card-top">
                <span className="hero-card-mark">
                  <TrustIcon type={content.trust[0].icon} />
                </span>
                <strong>{content.trust[0].highlight}</strong>
                <small>{content.trust[0].shortLabel}</small>
              </div>
              <div className="hero-floating-card hero-floating-card-bottom">
                <span className="hero-card-mark">
                  <TrustIcon type={content.trust[1].icon} />
                </span>
                <strong>{content.trust[1].highlight}</strong>
                <small>{content.trust[1].shortLabel}</small>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Studio highlights">
          {content.trust.map((item) => (
            <article className="trust-card" key={item.title}>
              <span className="trust-icon">
                <TrustIcon type={item.icon} />
              </span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section className="services section-pad" id="services">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{content.services.eyebrow}</p>
              <h2>{content.services.title}</h2>
            </div>
            <p>{content.services.description}</p>
          </div>

          <div className="service-grid">
            {content.services.items.map((service, index) => (
              <article className={`service-card service-card-${index + 1}`} key={service.title}>
                <div className="service-image">
                  <Image
                    src={service.image}
                    alt=""
                    fill
                    sizes="(max-width: 760px) 92vw, 30vw"
                  />
                </div>
                <div className="service-copy">
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                  <a
                    {...externalBookingLinkProps}
                    aria-label={`${content.navigation.booking}: ${service.title}`}
                  >
                    {content.navigation.booking} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            ))}
          </div>

          <Link className="text-link section-link" href={`${base}/services`}>
            {content.services.action} <span aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="about section-pad" id="about">
          <div className="about-collage">
            <div className="about-image-large">
              <Image
                src="/media/about/natali-at-work.jpg"
                alt=""
                fill
                sizes="(max-width: 800px) 90vw, 38vw"
              />
            </div>
            <div className="about-image-small">
              <Image
                src="/media/services/deep-tissue-massage.jpg"
                alt=""
                fill
                sizes="(max-width: 800px) 46vw, 19vw"
              />
            </div>
          </div>
          <div className="about-copy">
            <p className="eyebrow">{content.about.eyebrow}</p>
            <h2>{content.about.title}</h2>
            <p>{content.about.description}</p>
            <ul>
              {content.about.points.map((point) => (
                <li key={point}>
                  <span aria-hidden="true">✦</span> {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="about-signature" aria-hidden="true">
            <span>Magic Massage</span>
            <strong>Natali</strong>
          </div>
        </section>

        <section className="booking section-pad" id="booking">
          <div className="booking-card">
            <div className="booking-mark" aria-hidden="true">
              <TrustIcon type="access" />
            </div>
            <div className="booking-copy">
              <p className="eyebrow eyebrow-light">{content.booking.eyebrow}</p>
              <h2>{content.booking.title}</h2>
            </div>
            <div className="booking-action">
              <p>{content.booking.description}</p>
              <a className="button" {...externalBookingLinkProps}>
                {content.booking.action}
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
