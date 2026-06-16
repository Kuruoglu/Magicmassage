import Image from "next/image";
import Link from "next/link";

import type { HomeContent } from "@/content/home";
import type { Locale } from "@/i18n/config";

type HomePageViewProps = {
  locale: Locale;
  content: HomeContent;
};

export function HomePageView({ locale, content }: HomePageViewProps) {
  const base = `/${locale}`;

  return (
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
                <a className="button" href={`${base}#booking`}>
                  {content.hero.primaryAction}
                </a>
                <Link className="text-link text-link-light" href={`${base}/services`}>
                  {content.hero.secondaryAction}
                  <span aria-hidden="true"> →</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Studio highlights">
          {content.trust.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
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
            {content.services.items.map((service) => (
              <article className="service-card" key={service.title}>
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
                  <a href={`${base}#booking`} aria-label={`${content.navigation.booking}: ${service.title}`}>
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
                src="/media/gallery/studio-treatment-room.jpg"
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
        </section>

        <section className="booking section-pad" id="booking">
          <div className="booking-mark" aria-hidden="true">☯</div>
          <div>
            <p className="eyebrow eyebrow-light">{content.booking.eyebrow}</p>
            <h2>{content.booking.title}</h2>
          </div>
          <div className="booking-action">
            <p>{content.booking.description}</p>
            <a className="button button-light" href="tel:+359896778309">
              {content.booking.action}
            </a>
          </div>
        </section>
    </main>
  );
}
