import Image from "next/image";

import type { PublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";

type AboutPageViewProps = {
  locale: Locale;
  content: PublicPagesContent["about"];
};

export function AboutPageView({ content }: AboutPageViewProps) {
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
              src="/media/about/about-hero-premium.webp"
              alt=""
              fill
              priority
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
                src="/media/about/natali-at-work.jpg"
                alt={content.imageAlt}
                fill
                sizes="(max-width: 840px) 92vw, 42vw"
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
    </main>
  );
}
