import Image from "next/image";

import type { GiftCertificatesPageContent } from "@/content/gift-certificates-page";
import type { Locale } from "@/i18n/config";
import type { PublicMediaPlacement } from "@/lib/public-content/types";
import { resolvePublicMediaPlacement } from "@/lib/media-placement";
import { GiftCertificateForm } from "./gift-certificate-form";

type GiftCertificatesPageViewProps = {
  locale: Locale;
  content: GiftCertificatesPageContent;
  stripePublishableKey: string | null;
  mediaPlacements?: PublicMediaPlacement[];
};

export function GiftCertificatesPageView({
  locale,
  content,
  mediaPlacements,
  stripePublishableKey,
}: GiftCertificatesPageViewProps) {
  const heroMedia = resolvePublicMediaPlacement(mediaPlacements, "gift-certificates.hero", locale);

  return (
    <main>
      <section className="page-hero gift-hero section-pad">
        <div className="section-inner gift-hero-inner">
          <div className="gift-hero-copy">
            <p className="eyebrow eyebrow-light">{content.hero.eyebrow}</p>
            <h1>{content.hero.title}</h1>
            <p>{content.hero.description}</p>
          </div>
          <div className="gift-hero-visual" aria-hidden="true">
            <Image
              src={heroMedia?.url ?? "/media/gift-certificates/gift-certificate-hero-bow.webp"}
              alt=""
              fill
              priority
              unoptimized={Boolean(heroMedia)}
              sizes="(max-width: 720px) 86vw, 38vw"
            />
          </div>
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
