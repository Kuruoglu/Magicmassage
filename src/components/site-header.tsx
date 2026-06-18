import Image from "next/image";
import Link from "next/link";

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
  const links: Array<{ page: PublicPageKey; label: string }> = [
    { page: "home", label: content.navigation.home },
    { page: "services", label: content.navigation.services },
    { page: "about", label: content.navigation.about },
    { page: "contacts", label: content.navigation.contacts },
  ];

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
        </div>
      </div>
    </header>
  );
}
