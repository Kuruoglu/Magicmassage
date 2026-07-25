import Image from "next/image";

import { businessMapUrls } from "@/config/business";
import {
  externalMessengerLinkProps,
  messengerLinks,
  telegramUsername,
} from "@/config/messengers";
import type { PublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";
import { resolvePublicMediaPlacement } from "@/lib/media-placement";
import type { PublicBusinessDetails, PublicMediaPlacement } from "@/lib/public-content";
import { buildRuntimeMapUrls, localizeBusinessHoursSchedule, toPhoneHref } from "@/lib/business-hours";
import { ConsentGatedMap } from "./consent-gated-map";
import { MessengerIcon } from "./messenger-icon";

type ContactsPageViewProps = {
  businessDetails?: PublicBusinessDetails;
  locale: Locale;
  content: PublicPagesContent["contacts"];
  mediaPlacements?: PublicMediaPlacement[];
};

const runtimeMapDescriptions: Record<Locale, (address: string) => string> = {
  bg: (address) => `Картата показва Magic Massage Natali на адрес ${address}. Използвайте бутона за маршрут през Google Maps.`,
  ru: (address) => `Карта показывает Magic Massage Natali по адресу ${address}. Кнопка маршрута откроет Google Maps.`,
  ua: (address) => `Карта показує Magic Massage Natali за адресою ${address}. Кнопка маршруту відкриє Google Maps.`,
  en: (address) => `The map shows Magic Massage Natali at ${address}. The directions button opens Google Maps.`,
};

export function ContactsPageView({ businessDetails, locale, content, mediaPlacements }: ContactsPageViewProps) {
  const logoMedia = resolvePublicMediaPlacement(mediaPlacements, "global.logo", locale);
  const address = businessDetails?.address ?? content.address;
  const phone = businessDetails?.phone ?? content.phone;
  const phoneHref = toPhoneHref(phone);
  const mapUrls = businessDetails ? buildRuntimeMapUrls(address) : businessMapUrls;
  const mapDescription = businessDetails ? runtimeMapDescriptions[locale](address) : content.mapDescription;
  const workingSchedule = businessDetails
    ? localizeBusinessHoursSchedule(locale, businessDetails.workingSchedule)
    : undefined;
  const viberHref = `viber://chat?number=${encodeURIComponent(phoneHref)}`;
  return (
    <main>
      <section className="page-hero contact-hero section-pad">
        <div className="section-inner contact-hero-inner">
          <div className="contact-hero-copy">
            <p className="eyebrow eyebrow-light">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p>{content.description}</p>
          </div>
          <div
            className="contact-hero-logo-coin"
            data-testid="contacts-hero-logo-coin"
            aria-hidden="true"
          >
            <div className="contact-hero-logo-coin-inner">
              <span className="contact-hero-logo-coin-face contact-hero-logo-coin-front">
                <Image src={logoMedia?.url ?? "/media/logo.png"} alt="" width={260} height={260} priority />
              </span>
              <span className="contact-hero-logo-coin-face contact-hero-logo-coin-back">
                <Image src={logoMedia?.url ?? "/media/logo.png"} alt="" width={260} height={260} priority />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-page section-pad">
        <div className="section-inner contact-layout">
          <div className="contact-panel">
            <dl>
              <div>
                <dt>{content.addressLabel}</dt>
                <dd>{address}</dd>
              </div>
              <div>
                <dt>{content.phoneLabel}</dt>
                <dd>
                  <a href={`tel:${phoneHref}`}>{phone}</a>
                </dd>
              </div>
              <div>
                <dt>{content.hoursLabel}</dt>
                <dd>
                  {workingSchedule ? (
                    <ul className="contact-hours-list" aria-label={content.hoursLabel}>
                      {workingSchedule.map((day) => (
                        <li key={day.day}>
                          <span>{day.day}</span>
                          <strong>{day.time}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : content.hours}
                </dd>
              </div>
            </dl>
            <a className="button" href={`tel:${phoneHref}`}>
              {content.callAction}
            </a>
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
                href={viberHref}
                {...externalMessengerLinkProps}
              >
                <span aria-hidden="true">
                  <MessengerIcon name="viber" />
                </span>
                <strong>Viber</strong>
                <small>{phone}</small>
              </a>
            </div>
          </div>
          <div className="map-panel" aria-label={content.mapTitle}>
            <div className="map-frame">
              <ConsentGatedMap
                locale={locale}
                title={content.mapTitle}
                src={mapUrls.embed}
              />
            </div>
            <div className="map-copy">
              <h2>{content.mapTitle}</h2>
              <p>{mapDescription}</p>
              <a
                className="button button-light"
                href={mapUrls.directions}
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
