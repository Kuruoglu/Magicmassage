import { businessFacts, externalLinkProps } from "./business";

export const telegramUsername = businessFacts.social.telegramUsername;
export const telegramUrl = `https://t.me/${telegramUsername}`;

export const viberPhone = businessFacts.phone.tel;
export const viberUrl = `viber://chat?number=${encodeURIComponent(viberPhone)}`;

export const messengerLinks = {
  telegram: {
    label: "Telegram",
    href: telegramUrl,
  },
  viber: {
    label: "Viber",
    href: viberUrl,
  },
} as const;

export const externalMessengerLinkProps = {
  ...externalLinkProps,
} as const;
