import type { ReactNode } from "react";

import type { HomeContent } from "@/content/home";
import type { Locale } from "@/i18n/config";
import type { PublicPageKey } from "@/navigation/public-routes";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type PublicPageShellProps = {
  locale: Locale;
  currentPage: PublicPageKey;
  content: HomeContent;
  children: ReactNode;
};

export function PublicPageShell({
  locale,
  currentPage,
  content,
  children,
}: PublicPageShellProps) {
  return (
    <div className="site-shell">
      <SiteHeader locale={locale} currentPage={currentPage} content={content} />
      {children}
      <SiteFooter content={content} />
    </div>
  );
}
