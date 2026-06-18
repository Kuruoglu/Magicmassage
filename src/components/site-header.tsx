"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { HomeContent } from "@/content/home";
import { locales, type Locale } from "@/i18n/config";
import {
  getLocaleSwitchPath,
  getPublicPagePath,
  type PublicPageKey,
} from "@/navigation/public-routes";

const localeLabels: Record<Locale, string> = {
  bg: "BG",
  ru: "RU",
  ua: "UA",
};

type SiteHeaderProps = {
  locale: Locale;
  currentPage: PublicPageKey;
  content: HomeContent;
  localePaths?: Partial<Record<Locale, string>>;
};

export function SiteHeader({ locale, currentPage, content, localePaths }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mobileMenuId = useId();
  const links: Array<{ page: PublicPageKey; label: string }> = [
    { page: "home", label: content.navigation.home },
    { page: "services", label: content.navigation.services },
    { page: "about", label: content.navigation.about },
    { page: "contacts", label: content.navigation.contacts },
  ];
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("mobile-menu-open");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("mobile-menu-open");
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <div className="site-header-inner" data-testid="site-header-inner">
        <Link
          className="brand"
          href={getPublicPagePath(locale, "home")}
          aria-label={content.brand}
        >
          <Image src="/media/logo.png" alt="" width={58} height={58} priority />
          <span>
            <strong>Magic Massage</strong>
            <small>Natali</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          {links.map(({ page, label }) => (
            <Link
              key={page}
              href={getPublicPagePath(locale, page)}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="locale-switcher" aria-label="Language">
            {locales.map((item) => (
              <span className="locale-option" key={item}>
                {item !== locales[0] ? <span aria-hidden="true">/</span> : null}
                <Link
                  className={item === locale ? "is-active" : undefined}
                  href={localePaths?.[item] ?? getLocaleSwitchPath(item, currentPage)}
                  aria-current={item === locale ? "page" : undefined}
                >
                  {localeLabels[item]}
                </Link>
              </span>
            ))}
          </div>
          <Link className="button button-small" href={`/${locale}#booking`}>
            {content.navigation.booking}
          </Link>
          <button
            className="menu-toggle"
            type="button"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls={mobileMenuId}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className={isMenuOpen ? "mobile-menu-backdrop is-open" : "mobile-menu-backdrop"}
        aria-hidden="true"
        onClick={closeMenu}
      />
      <aside
        className={isMenuOpen ? "mobile-menu is-open" : "mobile-menu"}
        id={mobileMenuId}
        aria-hidden={!isMenuOpen}
      >
        <div className="mobile-menu-head">
          <Link
            className="brand"
            href={getPublicPagePath(locale, "home")}
            aria-label={content.brand}
            onClick={closeMenu}
          >
            <Image src="/media/logo.png" alt="" width={58} height={58} priority />
            <span>
              <strong>Magic Massage</strong>
              <small>Natali</small>
            </span>
          </Link>
          <button className="menu-close" type="button" aria-label="Close menu" onClick={closeMenu}>
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map(({ page, label }) => (
            <Link
              key={page}
              href={getPublicPagePath(locale, page)}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={closeMenu}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mobile-menu-footer">
          <div className="mobile-locale-switcher" aria-label="Language">
            {locales.map((item) => (
              <Link
                key={item}
                className={item === locale ? "is-active" : undefined}
                href={localePaths?.[item] ?? getLocaleSwitchPath(item, currentPage)}
                aria-current={item === locale ? "page" : undefined}
                onClick={closeMenu}
              >
                {localeLabels[item]}
              </Link>
            ))}
          </div>
          <Link className="button" href={`/${locale}#booking`} onClick={closeMenu}>
            {content.navigation.booking}
          </Link>
        </div>
      </aside>
    </header>
  );
}
