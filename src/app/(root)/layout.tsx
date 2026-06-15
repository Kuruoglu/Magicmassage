import type { Metadata } from "next";
import { Lora, Montserrat } from "next/font/google";

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
