import type { Locale } from "@/i18n/config";

export type LegalPageKey = "privacy" | "cookies" | "terms";

export type LegalPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
  }>;
};

const sharedThirdPartyNotes = {
  stripe:
    "Stripe handles card data in secure payment iframes for gift certificate purchases. Magic Massage Natali does not store card numbers, CVC or bank data.",
  maps:
    "Google Maps is loaded only after non-essential cookie consent. You can reject it and still use the address and directions link.",
  admin:
    "The public website does not collect appointment booking data directly; Studio24 handles appointment requests after the external handoff.",
};

const content: Record<Locale, Record<LegalPageKey, LegalPageContent>> = {
  bg: {
    privacy: {
      eyebrow: "Правна информация",
      title: "Политика за поверителност",
      description:
        "Кратко описание как Magic Massage Natali обработва лични данни през публичния сайт.",
      sections: [
        {
          title: "Какви данни се обработват",
          paragraphs: [
            "За стандартно записване сайтът отвежда към Studio24. Данните за часове и клиенти се въвеждат там, не в този сайт.",
            "При покупка на подаръчен сертификат се обработват данните, нужни за издаване и изпращане на сертификата.",
          ],
        },
        {
          title: "Плащания и външни услуги",
          paragraphs: [sharedThirdPartyNotes.stripe, sharedThirdPartyNotes.maps],
        },
        {
          title: "Контакт",
          paragraphs: ["За въпроси относно данните пишете на info@magicmassage.bg."],
        },
      ],
    },
    cookies: {
      eyebrow: "Cookies",
      title: "Политика за cookies",
      description:
        "Използваме необходими cookies и зареждаме Google Maps само след съгласие.",
      sections: [
        {
          title: "Необходими cookies",
          paragraphs: [
            "Необходимите cookies и local storage се използват за основна работа на сайта, например запомняне на избора за cookies.",
          ],
        },
        {
          title: "Незадължителни услуги",
          paragraphs: [sharedThirdPartyNotes.maps, sharedThirdPartyNotes.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Условия",
      title: "Условия за използване",
      description:
        "Основни условия за използване на сайта, Studio24 handoff и подаръчните сертификати.",
      sections: [
        {
          title: "Записване",
          paragraphs: [sharedThirdPartyNotes.admin],
        },
        {
          title: "Подаръчни сертификати",
          paragraphs: [
            "Подаръчните сертификати се издават след успешно плащане и се изпълняват ръчно по код.",
            "Ако плащане или имейл изпращане не завърши успешно, заявката се проверява ръчно.",
          ],
        },
      ],
    },
  },
  ru: {
    privacy: {
      eyebrow: "Правовая информация",
      title: "Политика конфиденциальности",
      description:
        "Кратко о том, как Magic Massage Natali обрабатывает данные на публичном сайте.",
      sections: [
        {
          title: "Какие данные обрабатываются",
          paragraphs: [
            "Для записи сайт переводит пользователя в Studio24. Данные записи и клиента вводятся там, а не на этом сайте.",
            "При покупке подарочного сертификата обрабатываются данные, необходимые для выпуска и отправки сертификата.",
          ],
        },
        {
          title: "Платежи и внешние сервисы",
          paragraphs: [sharedThirdPartyNotes.stripe, sharedThirdPartyNotes.maps],
        },
        {
          title: "Контакт",
          paragraphs: ["По вопросам данных пишите на info@magicmassage.bg."],
        },
      ],
    },
    cookies: {
      eyebrow: "Cookies",
      title: "Политика cookies",
      description:
        "Мы используем необходимые cookies, а Google Maps загружается только после согласия.",
      sections: [
        {
          title: "Необходимые cookies",
          paragraphs: [
            "Необходимые cookies и local storage используются для базовой работы сайта, включая сохранение выбора cookies.",
          ],
        },
        {
          title: "Необязательные сервисы",
          paragraphs: [sharedThirdPartyNotes.maps, sharedThirdPartyNotes.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Условия",
      title: "Условия использования",
      description:
        "Основные условия использования сайта, перехода в Studio24 и подарочных сертификатов.",
      sections: [
        {
          title: "Запись",
          paragraphs: [sharedThirdPartyNotes.admin],
        },
        {
          title: "Подарочные сертификаты",
          paragraphs: [
            "Подарочные сертификаты выпускаются после успешной оплаты и выполняются вручную по коду.",
            "Если платеж или отправка письма не завершились успешно, заявка проверяется вручную.",
          ],
        },
      ],
    },
  },
  ua: {
    privacy: {
      eyebrow: "Правова інформація",
      title: "Політика конфіденційності",
      description:
        "Коротко про те, як Magic Massage Natali обробляє дані на публічному сайті.",
      sections: [
        {
          title: "Які дані обробляються",
          paragraphs: [
            "Для запису сайт переводить користувача до Studio24. Дані запису і клієнта вводяться там, а не на цьому сайті.",
            "Під час купівлі подарункового сертифіката обробляються дані, потрібні для випуску і надсилання сертифіката.",
          ],
        },
        {
          title: "Платежі та зовнішні сервіси",
          paragraphs: [sharedThirdPartyNotes.stripe, sharedThirdPartyNotes.maps],
        },
        {
          title: "Контакт",
          paragraphs: ["З питань даних пишіть на info@magicmassage.bg."],
        },
      ],
    },
    cookies: {
      eyebrow: "Cookies",
      title: "Політика cookies",
      description:
        "Ми використовуємо необхідні cookies, а Google Maps завантажується лише після згоди.",
      sections: [
        {
          title: "Необхідні cookies",
          paragraphs: [
            "Необхідні cookies і local storage використовуються для базової роботи сайту, зокрема для збереження вибору cookies.",
          ],
        },
        {
          title: "Необов'язкові сервіси",
          paragraphs: [sharedThirdPartyNotes.maps, sharedThirdPartyNotes.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Умови",
      title: "Умови використання",
      description:
        "Основні умови використання сайту, переходу в Studio24 і подарункових сертифікатів.",
      sections: [
        {
          title: "Запис",
          paragraphs: [sharedThirdPartyNotes.admin],
        },
        {
          title: "Подарункові сертифікати",
          paragraphs: [
            "Подарункові сертифікати випускаються після успішної оплати і виконуються вручну за кодом.",
            "Якщо платіж або надсилання листа не завершилися успішно, заявка перевіряється вручну.",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      eyebrow: "Legal",
      title: "Privacy policy",
      description:
        "How Magic Massage Natali handles personal data on the public website.",
      sections: [
        {
          title: "Data we process",
          paragraphs: [
            "Appointment CTAs send visitors to Studio24. Appointment and client details are entered there, not into this public website.",
            "Gift certificate checkout processes the purchaser and recipient details needed to issue and deliver a certificate.",
          ],
        },
        {
          title: "Payments and third parties",
          paragraphs: [sharedThirdPartyNotes.stripe, sharedThirdPartyNotes.maps],
        },
        {
          title: "Contact",
          paragraphs: ["For privacy questions, email info@magicmassage.bg."],
        },
      ],
    },
    cookies: {
      eyebrow: "Cookies",
      title: "Cookie policy",
      description:
        "We use required storage and load Google Maps only after non-essential consent.",
      sections: [
        {
          title: "Required storage",
          paragraphs: [
            "Required cookies and local storage support basic site behavior, including saving your cookie choice.",
          ],
        },
        {
          title: "Optional services",
          paragraphs: [sharedThirdPartyNotes.maps, sharedThirdPartyNotes.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Terms",
      title: "Terms of use",
      description:
        "Basic terms for using the site, Studio24 booking handoff and gift certificates.",
      sections: [
        {
          title: "Booking",
          paragraphs: [sharedThirdPartyNotes.admin],
        },
        {
          title: "Gift certificates",
          paragraphs: [
            "Gift certificates are issued after successful payment and fulfilled manually by certificate code.",
            "If a payment or email delivery fails, the order is checked manually.",
          ],
        },
      ],
    },
  },
};

export function getLegalPageContent(locale: Locale, page: LegalPageKey): LegalPageContent {
  return content[locale][page];
}
