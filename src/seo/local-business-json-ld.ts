import type { HomeContent } from "@/content/home";
import { getPublicPagesContent } from "@/content/public-pages";
import { businessFacts } from "@/config/business";
import type { Locale } from "@/i18n/config";
import { siteUrl } from "@/seo/site-url";
import type { PublicBusinessDetails } from "@/lib/public-content";
import { toPhoneHref } from "@/lib/business-hours";

const descriptions: Record<Locale, string> = {
  bg: "Масажно студио в Бургас за индивидуален класически, релаксиращ, дълбокотъканен и антицелулитен масаж.",
  ru: "Массажный салон в Бургасе для индивидуального классического, расслабляющего, глубокого и антицеллюлитного массажа.",
  ua: "Масажний салон у Бургасі для індивідуального класичного, розслаблювального, глибокого та антицелюлітного масажу.",
  en: "Massage studio in Burgas for individual classic, relaxing, deep tissue and anti-cellulite massage.",
};

export function createLocalBusinessJsonLd(
  locale: Locale,
  content: HomeContent,
  businessDetails?: PublicBusinessDetails,
) {
  const services = getPublicPagesContent(locale).services.items;
  const phone = businessDetails?.phone ?? businessFacts.phone.display;
  const address = businessDetails?.address ?? businessFacts.address.streetAddress;
  const locality = businessDetails?.seoArea.split(",")[0]?.trim() || businessFacts.address.locality;
  const openingHoursSpecification = businessDetails?.workingSchedule
    .filter((day) => day.isOpen)
    .map((day) => ({
      "@type": "OpeningHoursSpecification",
      closes: day.closesAt,
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day.weekday - 1],
      opens: day.opensAt,
    }));

  return {
    "@context": "https://schema.org",
    "@type": "HealthAndBeautyBusiness",
    "@id": `${siteUrl}/#business`,
    name: businessDetails?.businessName ?? businessFacts.name,
    description: descriptions[locale],
    url: `${siteUrl}/${locale}`,
    image: `${siteUrl}/media/hero/hero-massage-session.jpg`,
    telephone: phone,
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: locality,
      addressCountry: businessFacts.address.countryCode,
    },
    areaServed: {
      "@type": "City",
      name: locality,
    },
    availableLanguage: ["Bulgarian", "Russian", "Ukrainian", "English"],
    ...(openingHoursSpecification ? { openingHoursSpecification } : {}),
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
      target: `tel:${toPhoneHref(phone)}`,
    },
  };
}
