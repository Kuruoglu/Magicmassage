import type { LegalPageContent } from "@/content/legal-pages";

type LegalPageViewProps = {
  content: LegalPageContent;
};

export function LegalPageView({ content }: LegalPageViewProps) {
  return (
    <main>
      <section className="page-hero legal-page-hero section-pad">
        <div className="section-inner">
          <p className="eyebrow eyebrow-light">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </section>
      <section className="legal-page section-pad">
        <div className="section-inner legal-page-inner">
          {content.sections.map((section) => (
            <section key={section.title} className="legal-section">
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
