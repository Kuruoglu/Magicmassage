import Link from "next/link";

import {
  externalMessengerLinkProps,
  messengerLinks,
  telegramUsername,
} from "@/config/messengers";
import type { PublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";
import { MessengerIcon } from "./messenger-icon";

type ContactsPageViewProps = {
  locale: Locale;
  content: PublicPagesContent["contacts"];
};

const googleMapsQuery = "49 ulitsa Mesta, Burgas, Bulgaria";
const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(googleMapsQuery)}&output=embed`;
const googleMapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(googleMapsQuery)}`;

export function ContactsPageView({ content }: ContactsPageViewProps) {
  return (
    <main>
      <section className="page-hero section-pad">
        <div className="section-inner">
          <p className="eyebrow eyebrow-light">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </section>

      <section className="contact-page section-pad">
        <div className="section-inner contact-layout">
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
            <div className="messenger-actions" aria-label="Messengers">
              <a
                className="messenger-link messenger-link-telegram"
                href={messengerLinks.telegram.href}
                {...externalMessengerLinkProps}
              >
                <span aria-hidden="true">
                  <MessengerIcon name="telegram" />
                </span>
                <strong>Telegram</strong>
                <small>@{telegramUsername}</small>
              </a>
              <a
                className="messenger-link messenger-link-viber"
                href={messengerLinks.viber.href}
                {...externalMessengerLinkProps}
              >
                <span aria-hidden="true">
                  <MessengerIcon name="viber" />
                </span>
                <strong>Viber</strong>
                <small>{content.phone}</small>
              </a>
            </div>
          </div>
          <div className="map-panel" aria-label={content.mapTitle}>
            <div className="map-frame">
              <iframe
                title={content.mapTitle}
                src={googleMapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <div className="map-copy">
              <h2>{content.mapTitle}</h2>
              <p>{content.mapDescription}</p>
              <a
                className="button button-light"
                href={googleMapsDirectionsUrl}
                target="_blank"
                rel="noreferrer"
              >
                {content.directionsAction}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
