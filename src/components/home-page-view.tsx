import Image from "next/image";
import Link from "next/link";

import type { HomeContent } from "@/content/home";
import { locales, type Locale } from "@/i18n/config";

type HomePageViewProps = {
  locale: Locale;
  content: HomeContent;
};

const localeLabels: Record<Locale, string> = {
  bg: "BG",
  ru: "RU",
  ua: "UA",
};

export function HomePageView({ locale, content }: HomePageViewProps) {
  const base = `/${locale}`;

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand" href={base} aria-label={content.brand}>
          <Image src="/media/logo.png" alt="" width={58} height={58} priority />
          <span>
            <strong>Magic Massage</strong>
            <small>Natali</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          <a href={`${base}#services`}>{content.navigation.services}</a>
          <a href={`${base}#about`}>{content.navigation.about}</a>
          <a href={`${base}#contact`}>{content.navigation.contacts}</a>
        </nav>

        <div className="header-actions">
          <div className="locale-switcher" aria-label="Language">
            {locales.map((item) => (
              <span className="locale-option" key={item}>
                {item !== locales[0] ? <span aria-hidden="true">/</span> : null}
                <Link
                  className={item === locale ? "is-active" : undefined}
                  href={`/${item}`}
                  aria-current={item === locale ? "page" : undefined}
                >
                  {localeLabels[item]}
                </Link>
              </span>
            ))}
          </div>
          <a className="button button-small" href={`${base}#booking`}>
            {content.navigation.booking}
          </a>
        </div>
      </header>

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
                <a className="text-link text-link-light" href={`${base}#services`}>
                  {content.hero.secondaryAction}
                  <span aria-hidden="true"> →</span>
                </a>
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

          <a className="text-link section-link" href={`${base}#services`}>
            {content.services.action} <span aria-hidden="true">→</span>
          </a>
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

      <footer className="site-footer section-pad" id="contact">
        <div>
          <p className="eyebrow">{content.contact.eyebrow}</p>
          <h2>{content.contact.title}</h2>
        </div>
        <dl>
          <div>
            <dt>{content.contact.addressLabel}</dt>
            <dd>{content.contact.address}</dd>
          </div>
          <div>
            <dt>{content.contact.phoneLabel}</dt>
            <dd><a href="tel:+359896778309">{content.contact.phone}</a></dd>
          </div>
          <div>
            <dt>{content.contact.hoursLabel}</dt>
            <dd>{content.contact.hours}</dd>
          </div>
        </dl>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {content.brand}</span>
          <span className="yin-yang" aria-hidden="true">☯</span>
        </div>
      </footer>
    </div>
  );
}
