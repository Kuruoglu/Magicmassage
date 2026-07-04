"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { externalBookingLinkProps } from "@/config/booking";
import { externalMessengerLinkProps, messengerLinks } from "@/config/messengers";
import type { HomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { locales, type Locale } from "@/i18n/config";
import {
  getLocaleSwitchPath,
  getPublicPagePath,
  type PublicPageKey,
} from "@/navigation/public-routes";
import { getServicePagePath } from "@/navigation/service-routes";
import { MessengerIcon } from "./messenger-icon";

const localeLabels: Record<Locale, string> = {
  bg: "BG",
  ru: "RU",
  ua: "UA",
  en: "EN",
};

type SiteHeaderProps = {
  locale: Locale;
  currentPage: PublicPageKey;
  content: HomeContent;
  localePaths?: Partial<Record<Locale, string>>;
};

export function SiteHeader({ locale, currentPage, content, localePaths }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"services" | "language" | null>(null);
  const mobileMenuId = useId();
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const links: Array<{ page: PublicPageKey; label: string }> = [
    { page: "home", label: content.navigation.home },
    { page: "services", label: content.navigation.services },
    { page: "about", label: content.navigation.about },
    { page: "contacts", label: content.navigation.contacts },
  ];
  const services = getPublicPagesContent(locale).services.items;
  const localePathFor = (item: Locale) =>
    localePaths?.[item] ?? getLocaleSwitchPath(item, currentPage);
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);
  const closeMenuAndRestoreFocus = useCallback(() => {
    closeMenu();
    window.setTimeout(() => menuToggleRef.current?.focus(), 0);
  }, [closeMenu]);
  const toggleDropdown = (dropdown: "services" | "language") => {
    setOpenDropdown((current) => (current === dropdown ? null : dropdown));
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    menuCloseRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenuAndRestoreFocus();
        return;
      }

      if (event.key !== "Tab" || !mobileMenuRef.current) {
        return;
      }

      const focusableItems = Array.from(
        mobileMenuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((item) => item.tabIndex >= 0);
      const firstItem = focusableItems[0];
      const lastItem = focusableItems[focusableItems.length - 1];

      if (!firstItem || !lastItem) {
        event.preventDefault();
        return;
      }

      if (!mobileMenuRef.current.contains(document.activeElement)) {
        event.preventDefault();
        firstItem.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("mobile-menu-open");

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("mobile-menu-open");
    };
  }, [closeMenuAndRestoreFocus, isMenuOpen]);

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
          {links.map(({ page, label }) =>
            page === "services" ? (
              <details
                className="nav-dropdown services-dropdown"
                key={page}
                open={openDropdown === "services"}
              >
                <summary
                  className={page === currentPage ? "is-active" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    toggleDropdown("services");
                  }}
                >
                  {label}
                </summary>
                <div className="dropdown-panel service-dropdown-panel">
                  <Link
                    href={getPublicPagePath(locale, "services")}
                    aria-current={page === currentPage ? "page" : undefined}
                    onClick={() => setOpenDropdown(null)}
                  >
                    {content.services.action}
                  </Link>
                  {services.map((service) => (
                    <Link
                      key={service.slug}
                      href={getServicePagePath(locale, service.slug)}
                      onClick={() => setOpenDropdown(null)}
                    >
                      {service.title}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link
                key={page}
                href={getPublicPagePath(locale, page)}
                aria-current={page === currentPage ? "page" : undefined}
              >
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="header-actions">
          <details className="nav-dropdown locale-select" open={openDropdown === "language"}>
            <summary
              aria-label="Language selector"
              onClick={(event) => {
                event.preventDefault();
                toggleDropdown("language");
              }}
            >
              {localeLabels[locale]}
            </summary>
            <div className="dropdown-panel locale-dropdown-panel" aria-label="Language">
              {locales.map((item) => (
                <Link
                  key={item}
                  className={item === locale ? "is-active" : undefined}
                  href={localePathFor(item)}
                  aria-current={item === locale ? "page" : undefined}
                  onClick={() => setOpenDropdown(null)}
                >
                  {localeLabels[item]}
                </Link>
              ))}
            </div>
          </details>
          <a className="button button-small" {...externalBookingLinkProps}>
            {content.navigation.booking}
          </a>
          <button
            ref={menuToggleRef}
            className="menu-toggle"
            type="button"
            aria-label={isMenuOpen ? "Close mobile menu" : "Open menu"}
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
        ref={mobileMenuRef}
        data-testid="mobile-menu"
        className={isMenuOpen ? "mobile-menu is-open" : "mobile-menu"}
        id={mobileMenuId}
        aria-hidden={!isMenuOpen}
        inert={isMenuOpen ? undefined : true}
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
          <button
            ref={menuCloseRef}
            className="menu-close"
            type="button"
            aria-label="Close menu"
            onClick={closeMenuAndRestoreFocus}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="mobile-locale-switcher" aria-label="Language">
          {locales.map((item) => (
            <Link
              key={item}
              className={item === locale ? "is-active" : undefined}
              href={localePathFor(item)}
              aria-current={item === locale ? "page" : undefined}
              onClick={closeMenu}
            >
              {localeLabels[item]}
            </Link>
          ))}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {links.map(({ page, label }) =>
            page === "services" ? (
              <details
                className="mobile-nav-details"
                key={page}
                open={currentPage === "services"}
              >
                <summary className={page === currentPage ? "is-active" : undefined}>
                  {label}
                </summary>
                <div className="mobile-services-list">
                  <Link
                    href={getPublicPagePath(locale, "services")}
                    aria-current={page === currentPage ? "page" : undefined}
                    onClick={closeMenu}
                  >
                    {content.services.action}
                  </Link>
                  {services.map((service) => (
                    <Link
                      key={service.slug}
                      href={getServicePagePath(locale, service.slug)}
                      onClick={closeMenu}
                    >
                      {service.title}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link
                key={page}
                href={getPublicPagePath(locale, page)}
                aria-current={page === currentPage ? "page" : undefined}
                onClick={closeMenu}
              >
                {label}
              </Link>
            ),
          )}
        </nav>

        <div className="mobile-menu-footer">
          <a className="button" {...externalBookingLinkProps} onClick={closeMenu}>
            {content.navigation.booking}
          </a>
          <div className="mobile-messenger-actions" aria-label="Messengers">
            <a
              href={messengerLinks.telegram.href}
              {...externalMessengerLinkProps}
              onClick={closeMenu}
            >
              <span aria-hidden="true">
                <MessengerIcon name="telegram" />
              </span>
              Telegram
            </a>
            <a href={messengerLinks.viber.href} {...externalMessengerLinkProps} onClick={closeMenu}>
              <span aria-hidden="true">
                <MessengerIcon name="viber" />
              </span>
              Viber
            </a>
          </div>
        </div>
      </aside>
    </header>
  );
}
