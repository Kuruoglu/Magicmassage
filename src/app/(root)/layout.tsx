import type { Metadata } from "next";

import { fontVariables } from "@/app/fonts";
import { businessFacts } from "@/config/business";
import { siteUrl } from "@/seo/site-url";

import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${businessFacts.name} | Burgas`,
  description: "Personal massage and relaxation in Burgas.",
};

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg-BG" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
