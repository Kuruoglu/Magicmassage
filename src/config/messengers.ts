export const telegramUsername = "NATALIBURACHEK";
export const telegramUrl = `https://t.me/${telegramUsername}`;

export const viberPhone = "+359896778309";
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
  rel: "noopener noreferrer",
  target: "_blank",
} as const;
