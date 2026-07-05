"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { CertificateContent, PublicPagesContent } from "@/content/public-pages";

type CertificateGalleryProps = {
  certificates: PublicPagesContent["about"]["certificates"];
};

type CertificateAspectStyle = CSSProperties & {
  "--certificate-aspect": string;
};

type CertificateCardProps = {
  certificate: CertificateContent;
  className?: string;
  index: number;
  onOpen: (index: number) => void;
  openLabel: string;
};

function getAspectStyle(certificate: CertificateContent): CertificateAspectStyle {
  return {
    "--certificate-aspect": `${certificate.image.width} / ${certificate.image.height}`,
  };
}

function CertificateCard({
  certificate,
  className,
  index,
  onOpen,
  openLabel,
}: CertificateCardProps) {
  const aspectStyle = getAspectStyle(certificate);
  const isFeatured = className === "certificate-card-feature";

  return (
    <div className={["certificate-card", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="certificate-open"
        onClick={() => onOpen(index)}
        aria-label={`${openLabel}: ${certificate.caption}`}
      >
        <span className="certificate-media" style={aspectStyle}>
          <Image
            src={certificate.image.src}
            alt={certificate.alt}
            width={certificate.image.width}
            height={certificate.image.height}
            loading="lazy"
            sizes={
              isFeatured
                ? "(max-width: 980px) 92vw, 58vw"
                : "(max-width: 720px) 92vw, (max-width: 1180px) 44vw, 22vw"
            }
          />
        </span>
        <span className="certificate-caption">{certificate.caption}</span>
      </button>
    </div>
  );
}

export function CertificateGallery({ certificates }: CertificateGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeCertificate =
    activeIndex === null ? null : certificates.items[activeIndex] ?? null;
  const activePosition = activeIndex === null ? 1 : activeIndex + 1;
  const portalRoot = typeof document === "undefined" ? null : document.body;

  const galleryGroups = useMemo(() => {
    const [featuredCertificate, ...supportingCertificates] = certificates.items;

    return {
      featuredCertificate,
      sideCertificates: supportingCertificates.slice(0, 2),
      lowerCertificates: supportingCertificates.slice(2),
    };
  }, [certificates.items]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex]);

  const showPrevious = () => {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return currentIndex === 0 ? certificates.items.length - 1 : currentIndex - 1;
    });
  };

  const showNext = () => {
    setActiveIndex((currentIndex) => {
      if (currentIndex === null) {
        return currentIndex;
      }

      return currentIndex === certificates.items.length - 1 ? 0 : currentIndex + 1;
    });
  };

  if (!galleryGroups.featuredCertificate) {
    return null;
  }

  const lightbox = activeCertificate ? (
    <div
      className="certificate-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={certificates.viewerLabel}
    >
      <button
        type="button"
        className="certificate-lightbox-backdrop"
        aria-label={certificates.closeLabel}
        onClick={() => setActiveIndex(null)}
        tabIndex={-1}
      />
      <div className="certificate-lightbox-panel">
        <div className="certificate-lightbox-toolbar">
          <p>{activeCertificate.caption}</p>
          <button
            type="button"
            className="certificate-lightbox-close"
            onClick={() => setActiveIndex(null)}
            aria-label={certificates.closeLabel}
            ref={closeButtonRef}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div
          className="certificate-lightbox-media"
          style={getAspectStyle(activeCertificate)}
        >
          <Image
            src={activeCertificate.image.src}
            alt={activeCertificate.alt}
            width={activeCertificate.image.width}
            height={activeCertificate.image.height}
            loading="eager"
            sizes="(max-width: 720px) 94vw, 86vw"
          />
        </div>

        <div className="certificate-lightbox-actions">
          <button
            type="button"
            onClick={showPrevious}
            aria-label={certificates.previousLabel}
          >
            <span aria-hidden="true">&lt;</span>
          </button>
          <span aria-live="polite">
            {activePosition} / {certificates.items.length}
          </span>
          <button
            type="button"
            onClick={showNext}
            aria-label={certificates.nextLabel}
          >
            <span aria-hidden="true">&gt;</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="certificates-mosaic">
        <div className="certificates-top-grid">
          <CertificateCard
            certificate={galleryGroups.featuredCertificate}
            className="certificate-card-feature"
            index={0}
            onOpen={setActiveIndex}
            openLabel={certificates.openLabel}
          />
          <div className="certificates-side-stack">
            {galleryGroups.sideCertificates.map((certificate, offset) => (
              <CertificateCard
                key={certificate.slug}
                certificate={certificate}
                index={offset + 1}
                onOpen={setActiveIndex}
                openLabel={certificates.openLabel}
              />
            ))}
          </div>
        </div>

        <div className="certificates-lower-grid">
          {galleryGroups.lowerCertificates.map((certificate, offset) => (
            <CertificateCard
              key={certificate.slug}
              certificate={certificate}
              index={offset + 3}
              onOpen={setActiveIndex}
              openLabel={certificates.openLabel}
            />
          ))}
        </div>
      </div>

      {portalRoot && lightbox ? createPortal(lightbox, portalRoot) : null}
    </>
  );
}
