import type { ReactNode } from "react";

import type { HomeContent } from "@/content/home";
import type { ServiceContent } from "@/content/public-pages";
import type { PublicMediaPlacement } from "@/lib/public-content";
import type { Locale } from "@/i18n/config";
import type { PublicPageKey } from "@/navigation/public-routes";
import { CookieConsentBanner } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PublicPageShellProps = {
  locale: Locale;
  currentPage?: PublicPageKey;
  content: HomeContent;
  children: ReactNode;
  giftCertificatesEnabled?: boolean;
  localePaths?: Partial<Record<Locale, string>>;
  mediaPlacements?: PublicMediaPlacement[];
  services?: ServiceContent[];
};

export function PublicPageShell({
  locale,
  currentPage,
  content,
  children,
  giftCertificatesEnabled = true,
  localePaths,
  mediaPlacements,
  services,
}: PublicPageShellProps) {
  return (
    <div className="site-shell">
      <SiteHeader
        locale={locale}
        currentPage={currentPage}
        content={content}
        giftCertificatesEnabled={giftCertificatesEnabled}
        localePaths={localePaths}
        mediaPlacements={mediaPlacements}
        services={services}
      />
      {children}
      <CookieConsentBanner locale={locale} />
      <SiteFooter content={content} locale={locale} />
    </div>
  );
}
