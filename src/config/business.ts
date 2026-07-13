export const businessFacts = {
  name: "Magic Massage Natali",
  address: {
    display: "Mesta Street 49, Burgas",
    streetAddress: "ul. Mesta 49",
    locality: "Burgas",
    countryCode: "BG",
    mapQuery: "49 ulitsa Mesta, Burgas, Bulgaria",
  },
  phone: {
    display: "+359 89 677 8309",
    tel: "+359896778309",
  },
  email: "info@magicmassage.bg",
  bookingUrl: "https://studio24.bg/magic-massage-studio-natali-s8031",
  social: {
    telegramUsername: "NATALIBURACHEK",
    instagramUrl: "",
  },
} as const;

export const businessMapUrls = {
  embed: `https://www.google.com/maps?q=${encodeURIComponent(
    businessFacts.address.mapQuery,
  )}&output=embed`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    businessFacts.address.mapQuery,
  )}`,
  search: `https://maps.google.com/?q=${encodeURIComponent(
    `${businessFacts.name} ${businessFacts.address.locality}`,
  )}`,
} as const;

export const externalLinkProps = {
  rel: "noopener noreferrer",
  target: "_blank",
} as const;
