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
          <div>
            <dt>{content.contact.hoursLabel}</dt>
            <dd>{content.contact.hours}</dd>
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
