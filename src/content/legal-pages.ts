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

const thirdPartyNotes: Record<Locale, { maps: string; stripe: string }> = {
  bg: {
    stripe: "Stripe обработва данните на картата в защитени платежни полета при покупка на подаръчен сертификат. Magic Massage Natali не съхранява номер на карта, CVC или банкови данни.",
    maps: "Google Maps се зарежда само след съгласие за незадължителни cookies. Можете да откажете и пак да използвате адреса и връзката за маршрут.",
  },
  ru: {
    stripe: "Stripe обрабатывает данные карты в защищённых платёжных полях при покупке подарочного сертификата. Magic Massage Natali не хранит номер карты, CVC или банковские данные.",
    maps: "Google Maps загружается только после согласия на необязательные cookies. Можно отказаться и продолжить использовать адрес и ссылку на маршрут.",
  },
  ua: {
    stripe: "Stripe обробляє дані картки в захищених платіжних полях під час купівлі подарункового сертифіката. Magic Massage Natali не зберігає номер картки, CVC або банківські дані.",
    maps: "Google Maps завантажується лише після згоди на необов'язкові cookies. Можна відмовитися й далі користуватися адресою та посиланням на маршрут.",
  },
  en: {
    stripe: "Stripe handles card data in secure payment fields for gift certificate purchases. Magic Massage Natali does not store card numbers, CVC or bank data.",
    maps: "Google Maps loads only after consent to optional cookies. You can decline and still use the address and directions link.",
  },
};

const bookingTerms: Record<Locale, string> = {
  bg: "При включено онлайн записване избраният час се задържа временно. След окончателното потвърждение се създава потвърден час веднага. Когато онлайн записването е изключено, бутоните отвеждат към Studio24.",
  ru: "При включённой онлайн-записи выбранное время временно удерживается. После окончательного подтверждения запись сразу получает статус подтверждённой. Когда онлайн-запись отключена, кнопки ведут в Studio24.",
  ua: "Коли онлайн-запис увімкнено, обраний час тимчасово утримується. Після остаточного підтвердження одразу створюється підтверджений запис. Коли онлайн-запис вимкнено, кнопки ведуть до Studio24.",
  en: "When online booking is enabled, the selected time is held temporarily. Final confirmation creates a confirmed appointment immediately. When online booking is disabled, booking buttons lead to Studio24.",
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
            "При онлайн записване сайтът обработва избраната услуга, дата и час, име, телефон, незадължителен имейл, предпочитан начин за контакт и незадължителна бележка. Данните се съхраняват в защитената CRM система на Magic Massage Natali за управление на часа и връзка с клиента.",
            "Когато онлайн записването е изключено, сайтът отвежда към Studio24 и данните за часа се въвеждат там.",
            "При покупка на подаръчен сертификат се обработват данните, нужни за издаване и изпращане на сертификата.",
          ],
        },
        {
          title: "Плащания и външни услуги",
          paragraphs: [thirdPartyNotes.bg.stripe, thirdPartyNotes.bg.maps],
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
          paragraphs: [thirdPartyNotes.bg.maps, thirdPartyNotes.bg.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Условия",
      title: "Условия за използване",
      description:
        "Основни условия за онлайн записване, използване на сайта и подаръчните сертификати.",
      sections: [
        {
          title: "Записване",
          paragraphs: [bookingTerms.bg],
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
            "При онлайн-записи сайт обрабатывает выбранную услугу, дату и время, имя, телефон, необязательный email, предпочтительный способ связи и необязательный комментарий. Данные хранятся в защищённой CRM Magic Massage Natali для управления записью и связи с клиентом.",
            "Когда онлайн-запись отключена, сайт переводит пользователя в Studio24, где вводятся данные записи.",
            "При покупке подарочного сертификата обрабатываются данные, необходимые для выпуска и отправки сертификата.",
          ],
        },
        {
          title: "Платежи и внешние сервисы",
          paragraphs: [thirdPartyNotes.ru.stripe, thirdPartyNotes.ru.maps],
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
          paragraphs: [thirdPartyNotes.ru.maps, thirdPartyNotes.ru.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Условия",
      title: "Условия использования",
      description:
        "Основные условия онлайн-записи, использования сайта и подарочных сертификатов.",
      sections: [
        {
          title: "Запись",
          paragraphs: [bookingTerms.ru],
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
            "Під час онлайн-запису сайт обробляє обрану послугу, дату й час, ім'я, телефон, необов'язковий email, бажаний спосіб зв'язку та необов'язковий коментар. Дані зберігаються в захищеній CRM Magic Massage Natali для керування записом і зв'язку з клієнтом.",
            "Коли онлайн-запис вимкнено, сайт переводить користувача до Studio24, де вводяться дані запису.",
            "Під час купівлі подарункового сертифіката обробляються дані, потрібні для випуску і надсилання сертифіката.",
          ],
        },
        {
          title: "Платежі та зовнішні сервіси",
          paragraphs: [thirdPartyNotes.ua.stripe, thirdPartyNotes.ua.maps],
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
          paragraphs: [thirdPartyNotes.ua.maps, thirdPartyNotes.ua.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Умови",
      title: "Умови використання",
      description:
        "Основні умови онлайн-запису, використання сайту й подарункових сертифікатів.",
      sections: [
        {
          title: "Запис",
          paragraphs: [bookingTerms.ua],
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
            "For online booking, the site processes the selected service, date and time, name, phone number, optional email, preferred contact method and optional note. The data is stored in Magic Massage Natali's protected CRM to manage the appointment and contact the customer.",
            "When online booking is disabled, the site sends visitors to Studio24, where booking details are entered.",
            "Gift certificate checkout processes the purchaser and recipient details needed to issue and deliver a certificate.",
          ],
        },
        {
          title: "Payments and third parties",
          paragraphs: [thirdPartyNotes.en.stripe, thirdPartyNotes.en.maps],
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
          paragraphs: [thirdPartyNotes.en.maps, thirdPartyNotes.en.stripe],
        },
      ],
    },
    terms: {
      eyebrow: "Terms",
      title: "Terms of use",
      description:
        "Basic terms for online booking, use of the site and gift certificates.",
      sections: [
        {
          title: "Booking",
          paragraphs: [bookingTerms.en],
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
