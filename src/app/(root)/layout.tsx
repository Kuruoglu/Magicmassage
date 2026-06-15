import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";

import "../globals.css";

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["cyrillic", "latin"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Magic Massage Natali | Burgas",
  description: "Personal massage and relaxation in Burgas.",
};

export default function RootRedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg-BG" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
