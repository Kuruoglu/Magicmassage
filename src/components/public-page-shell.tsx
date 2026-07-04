import type { ReactNode } from "react";

import type { HomeContent } from "@/content/home";
import type { Locale } from "@/i18n/config";
import type { PublicPageKey } from "@/navigation/public-routes";
import { CookieConsentBanner } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PublicPageShellProps = {
  locale: Locale;
  currentPage: PublicPageKey;
  content: HomeContent;
  children: ReactNode;
  localePaths?: Partial<Record<Locale, string>>;
};

export function PublicPageShell({
  locale,
  currentPage,
  content,
  children,
  localePaths,
}: PublicPageShellProps) {
  return (
    <div className="site-shell">
      <SiteHeader
        locale={locale}
        currentPage={currentPage}
        content={content}
        localePaths={localePaths}
      />
      {children}
      <SiteFooter content={content} />
      <CookieConsentBanner locale={locale} />
    </div>
  );
}
