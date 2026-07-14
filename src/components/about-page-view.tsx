import Image from "next/image";

import { CertificateGallery } from "@/components/certificate-gallery";
import type { PublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";
import type { PublicMediaPlacement } from "@/lib/public-content/types";
import { resolvePublicMediaPlacement } from "@/lib/media-placement";

type AboutPageViewProps = {
  locale: Locale;
  content: PublicPagesContent["about"];
  mediaPlacements?: PublicMediaPlacement[];
};

export function AboutPageView({ content, locale, mediaPlacements }: AboutPageViewProps) {
  const heroMedia = resolvePublicMediaPlacement(mediaPlacements, "about.hero", locale);
  const portraitMedia = resolvePublicMediaPlacement(mediaPlacements, "about.portrait", locale);

  return (
    <main>
      <section className="page-hero about-page-hero section-pad">
        <div className="section-inner about-page-hero-inner">
          <div className="about-page-hero-copy">
            <p className="eyebrow eyebrow-light">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p>{content.lead}</p>
          </div>
          <div className="about-page-hero-visual" aria-hidden="true">
            <Image
              src={heroMedia?.url ?? "/media/about/about-hero-premium.webp"}
              alt=""
              fill
              priority
              unoptimized={Boolean(heroMedia)}
              sizes="(max-width: 980px) 92vw, 38vw"
            />
          </div>
        </div>
      </section>

      <section className="story-section section-pad">
        <div className="section-inner story-layout">
          <div className="story-images">
            <div className="story-image-large">
              <Image
                src={portraitMedia?.url ?? "/media/about/natali-portrait.jpg"}
                alt={content.imageAlt}
                fill
                sizes="(max-width: 840px) 92vw, 42vw"
                unoptimized={Boolean(portraitMedia)}
              />
            </div>
          </div>
          <div className="story-copy">
            {content.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <ul>
              {content.values.map((value) => (
                <li key={value}>
                  <span aria-hidden="true">☯</span>
                  {value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="certificates-section section-pad" aria-labelledby="about-certificates-title">
        <div className="section-inner">
          <div className="certificates-heading">
            <p className="eyebrow eyebrow-light">{content.certificates.eyebrow}</p>
            <h2 id="about-certificates-title">{content.certificates.title}</h2>
            <p>{content.certificates.description}</p>
          </div>

          <CertificateGallery certificates={content.certificates} locale={locale} mediaPlacements={mediaPlacements} />
        </div>
      </section>
    </main>
  );
}
