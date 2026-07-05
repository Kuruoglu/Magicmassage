import type { GiftCertificatesPageContent } from "@/content/gift-certificates-page";
import type { Locale } from "@/i18n/config";
import { GiftCertificateForm } from "./gift-certificate-form";

type GiftCertificatesPageViewProps = {
  locale: Locale;
  content: GiftCertificatesPageContent;
  stripePublishableKey: string | null;
};

export function GiftCertificatesPageView({
  locale,
  content,
  stripePublishableKey,
}: GiftCertificatesPageViewProps) {
  return (
    <main>
      <section className="page-hero gift-hero section-pad">
        <div className="section-inner gift-hero-inner">
          <p className="eyebrow eyebrow-light">{content.hero.eyebrow}</p>
          <h1>{content.hero.title}</h1>
          <p>{content.hero.description}</p>
        </div>
      </section>

      <section className="gift-page-section section-pad">
        <div className="section-inner gift-page-grid">
          <aside className="gift-intro-panel">
            <h2>{content.intro.title}</h2>
            <ul>
              {content.intro.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>

          <GiftCertificateForm
            locale={locale}
            content={content.form}
            stripePublishableKey={stripePublishableKey}
          />
        </div>
      </section>
    </main>
  );
}
