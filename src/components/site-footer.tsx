import {
  externalMessengerLinkProps,
  messengerLinks,
  telegramUsername,
} from "@/config/messengers";
import type { HomeContent } from "@/content/home";
import type { Locale } from "@/i18n/config";
import { localizeBusinessHoursSchedule, toPhoneHref } from "@/lib/business-hours";
import type { PublicBusinessDetails } from "@/lib/public-content";
import { getPublicPagePath } from "@/navigation/public-routes";
import { MessengerIcon } from "./messenger-icon";

type SiteFooterProps = {
  businessDetails?: PublicBusinessDetails;
  content: HomeContent;
  locale: Locale;
};

export function SiteFooter({ businessDetails, content, locale }: SiteFooterProps) {
  const address = businessDetails?.address ?? content.contact.address;
  const phone = businessDetails?.phone ?? content.contact.phone;
  const phoneHref = toPhoneHref(phone);
  const hoursSchedule = businessDetails
    ? localizeBusinessHoursSchedule(locale, businessDetails.workingSchedule)
    : content.contact.hoursSchedule;
  const viberHref = `viber://chat?number=${encodeURIComponent(phoneHref)}`;

  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer-inner" data-testid="site-footer-inner">
        <div>
          <p className="eyebrow">{content.contact.eyebrow}</p>
          <h2>{content.contact.title}</h2>
        </div>
        <dl>
          <div>
            <dt>{content.contact.addressLabel}</dt>
            <dd>{address}</dd>
          </div>
          <div>
            <dt>{content.contact.phoneLabel}</dt>
            <dd><a href={`tel:${phoneHref}`}>{phone}</a></dd>
          </div>
          <div className="footer-hours">
            <dt>
              <span className="footer-hours-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M7 3v3M17 3v3M4.5 9.2h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
                  <path d="M8 13h2M14 13h2M8 17h2M14 17h2" />
                </svg>
              </span>
              {content.contact.hoursLabel}
            </dt>
            <dd>
              <ul className="footer-hours-list" aria-label={content.contact.hoursLabel}>
                {hoursSchedule.map((item) => (
                  <li key={item.day}>
                    <span>{item.day}</span>
                    <span>{item.time}</span>
                  </li>
                ))}
              </ul>
              <p className="footer-hours-note">{content.contact.hours}</p>
            </dd>
          </div>
        </dl>
        <div className="footer-messengers" aria-label="Messengers">
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
        <div className="footer-bottom">
          <nav className="footer-legal-links" aria-label="Legal">
            <a href={getPublicPagePath(locale, "privacy")}>Privacy</a>
            <a href={getPublicPagePath(locale, "cookies")}>Cookies</a>
            <a href={getPublicPagePath(locale, "terms")}>Terms</a>
          </nav>
          <span>© {new Date().getFullYear()} {content.brand}</span>
          <span className="yin-yang" aria-hidden="true">☯</span>
        </div>
      </div>
    </footer>
  );
}
