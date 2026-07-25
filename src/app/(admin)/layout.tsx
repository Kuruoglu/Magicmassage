import type { Metadata } from "next";

import { fontVariables } from "@/app/fonts";
import { AdminSessionBridge } from "@/components/admin/admin-session-bridge";
import { businessFacts } from "@/config/business";
import { siteUrl } from "@/seo/site-url";

import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `Admin | ${businessFacts.name}`,
  robots: {
    follow: false,
    index: false,
  },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={fontVariables} data-scroll-behavior="smooth">
      <body>
        <AdminSessionBridge />
        {children}
      </body>
    </html>
  );
}
