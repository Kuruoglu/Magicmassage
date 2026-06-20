import type { HomeContent } from "@/content/home";

type SiteFooterProps = {
  content: HomeContent;
};

export function SiteFooter({ content }: SiteFooterProps) {
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
            <dd>{content.contact.address}</dd>
          </div>
          <div>
            <dt>{content.contact.phoneLabel}</dt>
            <dd><a href="tel:+359896778309">{content.contact.phone}</a></dd>
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
                {content.contact.hoursSchedule.map((item) => (
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
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {content.brand}</span>
          <span className="yin-yang" aria-hidden="true">☯</span>
        </div>
      </div>
    </footer>
  );
}
