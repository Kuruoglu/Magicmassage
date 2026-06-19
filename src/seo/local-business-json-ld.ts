import type { HomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import type { Locale } from "@/i18n/config";
import { siteUrl } from "@/seo/site-url";

const descriptions: Record<Locale, string> = {
  bg: "Масажно студио в Бургас за индивидуален класически, релаксиращ, дълбокотъканен и антицелулитен масаж.",
  ru: "Массажный салон в Бургасе для индивидуального классического, расслабляющего, глубокого и антицеллюлитного массажа.",
  ua: "Масажний салон у Бургасі для індивідуального класичного, розслаблювального, глибокого та антицелюлітного масажу.",
  en: "Massage studio in Burgas for individual classic, relaxing, deep tissue and anti-cellulite massage.",
};

export function createLocalBusinessJsonLd(locale: Locale, content: HomeContent) {
  const services = getPublicPagesContent(locale).services.items;

  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${siteUrl}/#business`,
    name: "Magic Massage Natali",
    description: descriptions[locale],
    url: `${siteUrl}/${locale}`,
    image: `${siteUrl}/media/hero/hero-massage-session.jpg`,
    telephone: content.contact.phone,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ul. Mesta 49",
      addressLocality: "Burgas",
      addressCountry: "BG",
    },
    areaServed: {
      "@type": "City",
      name: "Burgas",
    },
    availableLanguage: ["Bulgarian", "Russian", "Ukrainian", "English"],
    makesOffer: services.map((service) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: service.title,
        description: service.description,
      },
    })),
    potentialAction: {
      "@type": "ReserveAction",
      target: `tel:${content.contact.phone.replace(/[^\d+]/g, "")}`,
    },
  };
}
