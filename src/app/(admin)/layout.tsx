import type { Metadata } from "next";
import { Lora, Montserrat } from "next/font/google";

import { siteUrl } from "@/seo/site-url";

import "../globals.css";

const sans = Montserrat({
  variable: "--font-sans",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const serif = Lora({
  variable: "--font-serif",
  weight: ["500", "600"],
  subsets: ["cyrillic", "latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Admin | Magic Massage Natali",
  robots: {
    follow: false,
    index: false,
  },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
