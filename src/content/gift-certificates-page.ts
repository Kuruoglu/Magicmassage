import {
  giftCertificateSalesConfig,
  giftCertificateServiceSlugs,
  getGiftCertificateServiceDefinition,
  type GiftCertificateServiceSlug,
} from "@/content/gift-certificates";
import type { Locale } from "@/i18n/config";

export type GiftCertificateServiceFormOption = {
  slug: GiftCertificateServiceSlug;
  title: string;
  priceEur: number;
};

export type GiftCertificatesPageContent = {
  hero: {
    eyebrow: string;
    title: string;
    description: string;
  };
  intro: {
    title: string;
    items: string[];
  };
  form: {
    title: string;
    description: string;
    selfModeLabel: string;
    giftModeLabel: string;
    purchaserNameLabel: string;
    purchaserEmailLabel: string;
    recipientNameLabel: string;
    recipientMessageLabel: string;
    recipientEmailLabel: string;
    deliverySectionLabel: string;
    deliveryBuyerOnlyLabel: string;
    deliveryRecipientEmailLabel: string;
    serviceLabel: string;
    sessionsLabel: string;
    addMassageAction: string;
    removeMassageAction: string;
    amountTitle: string;
    customAmountLabel: string;
    totalLabel: string;
    bgnEquivalentLabel: string;
    validityNotice: string;
    validityConfirmationNotice: string;
    paymentSectionTitle: string;
    paymentPrivacyNotice: string;
    demoPaymentNotice: string;
    payAction: string;
    preparingPayment: string;
    paymentSuccess: string;
    paymentError: string;
    services: GiftCertificateServiceFormOption[];
    sessionOptions: readonly number[];
    quickAmountValuesEur: readonly number[];
    amountMinEur: number;
    amountMaxEur: number;
  };
};

const localizedCopy: Record<
  Locale,
  Omit<GiftCertificatesPageContent, "form"> & {
    form: Omit<
      GiftCertificatesPageContent["form"],
      | "services"
      | "deliverySectionLabel"
      | "sessionOptions"
      | "quickAmountValuesEur"
      | "amountMinEur"
      | "amountMaxEur"
    >;
  }
> = {
  bg: {
    hero: {
      eyebrow: "Подарък за спокойствие",
      title: "Подаръчни сертификати за масаж",
      description:
        "Изберете конкретни масажи, брой сеанси или свободна сума в EUR за един персонален сертификат.",
    },
    intro: {
      title: "Как работи",
      items: [
        "Един заказ създава един сертификат за един получател.",
        "В сертификата могат да се комбинират няколко масажа и/или сума.",
        "Използването е ръчно по уникален код и с предварителна уговорка.",
      ],
    },
    form: {
      title: "Създайте сертификат",
      description: "Цените са test-mode placeholders и трябва да се потвърдят от клиента преди live плащания.",
      selfModeLabel: "За себе си",
      giftModeLabel: "За подарък",
      purchaserNameLabel: "Вашето име",
      purchaserEmailLabel: "Вашият email",
      recipientNameLabel: "Име на получателя",
      recipientMessageLabel: "Кратко пожелание",
      recipientEmailLabel: "Email на получателя",
      deliveryBuyerOnlyLabel: "Аз ще изпратя сертификата",
      deliveryRecipientEmailLabel: "Изпрати автоматично на получателя",
      serviceLabel: "Масаж",
      sessionsLabel: "Брой сеанси",
      addMassageAction: "+ Добави масаж",
      removeMassageAction: "Премахни",
      amountTitle: "Свободна сума",
      customAmountLabel: "Своя сума в EUR",
      totalLabel: "Общо",
      bgnEquivalentLabel: "BGN еквивалент до 8 август 2026",
      validityNotice: "Срок на валидност: 6 месеца.",
      validityConfirmationNotice: "Валиден 6 месеца от датата на покупка.",
      paymentSectionTitle: "Плащане",
      paymentPrivacyNotice:
        "Данните на картата се обработват от Stripe. Magic Massage Natali не съхранява номер на карта, CVC или финансови данни.",
      demoPaymentNotice: "Demo/test mode: реални плащания не се приемат без финални цени и включен live flag.",
      payAction: "Плати сертификата",
      preparingPayment: "Подготовка на плащане...",
      paymentSuccess: "Плащането е успешно. Сертификатът ще бъде изпратен по email.",
      paymentError: "Плащането не беше завършено. Моля, опитайте отново.",
    },
  },
  ru: {
    hero: {
      eyebrow: "Подарок для спокойствия",
      title: "Подарочные сертификаты на массаж",
      description:
        "Выберите конкретные массажи, количество сеансов или свободную сумму в EUR для одного персонального сертификата.",
    },
    intro: {
      title: "Как это работает",
      items: [
        "Один заказ создает один сертификат для одного получателя.",
        "В сертификате можно совместить несколько массажей и/или сумму.",
        "Использование сертификата выполняется вручную по уникальному коду и по предварительной записи.",
      ],
    },
    form: {
      title: "Создать сертификат",
      description: "Цены являются test-mode placeholders и должны быть утверждены заказчиком перед live-оплатами.",
      selfModeLabel: "Для себя",
      giftModeLabel: "В подарок",
      purchaserNameLabel: "Ваше имя",
      purchaserEmailLabel: "Ваш email",
      recipientNameLabel: "Имя получателя",
      recipientMessageLabel: "Короткое сообщение/пожелание",
      recipientEmailLabel: "Email получателя",
      deliveryBuyerOnlyLabel: "Я сам отправлю сертификат",
      deliveryRecipientEmailLabel: "Отправить получателю автоматически",
      serviceLabel: "Массаж",
      sessionsLabel: "Количество сеансов",
      addMassageAction: "+ Добавить массаж",
      removeMassageAction: "Удалить",
      amountTitle: "Свободная сумма",
      customAmountLabel: "Своя сумма в EUR",
      totalLabel: "Итого",
      bgnEquivalentLabel: "BGN-эквивалент до 8 августа 2026",
      validityNotice: "Срок действия: 6 месяцев.",
      validityConfirmationNotice: "Действует 6 месяцев с даты покупки.",
      paymentSectionTitle: "Оплата",
      paymentPrivacyNotice:
        "Данные карты обрабатывает Stripe. Magic Massage Natali не хранит номер карты, CVC и финансовые данные.",
      demoPaymentNotice: "Demo/test mode: реальные платежи не принимаются без финальных цен и включенного live flag.",
      payAction: "Оплатить сертификат",
      preparingPayment: "Подготовка оплаты...",
      paymentSuccess: "Оплата прошла успешно. Сертификат будет отправлен по email.",
      paymentError: "Оплата не завершена. Попробуйте еще раз.",
    },
  },
  ua: {
    hero: {
      eyebrow: "Подарунок для спокою",
      title: "Подарункові сертифікати на масаж",
      description:
        "Оберіть конкретні масажі, кількість сеансів або вільну суму в EUR для одного персонального сертифіката.",
    },
    intro: {
      title: "Як це працює",
      items: [
        "Одне замовлення створює один сертифікат для одного отримувача.",
        "У сертифікаті можна поєднати кілька масажів і/або суму.",
        "Використання сертифіката виконується вручну за унікальним кодом і за попереднім записом.",
      ],
    },
    form: {
      title: "Створити сертифікат",
      description: "Ціни є test-mode placeholders і мають бути підтверджені замовником перед live-оплатами.",
      selfModeLabel: "Для себе",
      giftModeLabel: "У подарунок",
      purchaserNameLabel: "Ваше ім'я",
      purchaserEmailLabel: "Ваш email",
      recipientNameLabel: "Ім'я отримувача",
      recipientMessageLabel: "Коротке повідомлення/побажання",
      recipientEmailLabel: "Email отримувача",
      deliveryBuyerOnlyLabel: "Я сам надішлю сертифікат",
      deliveryRecipientEmailLabel: "Надіслати отримувачу автоматично",
      serviceLabel: "Масаж",
      sessionsLabel: "Кількість сеансів",
      addMassageAction: "+ Додати масаж",
      removeMassageAction: "Видалити",
      amountTitle: "Вільна сума",
      customAmountLabel: "Своя сума в EUR",
      totalLabel: "Разом",
      bgnEquivalentLabel: "BGN-еквівалент до 8 серпня 2026",
      validityNotice: "Строк дії: 6 місяців.",
      validityConfirmationNotice: "Діє 6 місяців з дати покупки.",
      paymentSectionTitle: "Оплата",
      paymentPrivacyNotice:
        "Дані картки обробляє Stripe. Magic Massage Natali не зберігає номер картки, CVC та фінансові дані.",
      demoPaymentNotice: "Demo/test mode: реальні платежі не приймаються без фінальних цін і ввімкненого live flag.",
      payAction: "Оплатити сертифікат",
      preparingPayment: "Підготовка оплати...",
      paymentSuccess: "Оплата пройшла успішно. Сертифікат буде надіслано email.",
      paymentError: "Оплату не завершено. Спробуйте ще раз.",
    },
  },
  en: {
    hero: {
      eyebrow: "A calm gift",
      title: "Massage gift certificates",
      description:
        "Choose specific massages, the number of sessions or a free EUR amount for one personal certificate.",
    },
    intro: {
      title: "How it works",
      items: [
        "One order creates one certificate for one recipient.",
        "A certificate can combine several massages and/or an amount voucher.",
        "Certificate redemption is manual by unique code and by appointment.",
      ],
    },
    form: {
      title: "Create a certificate",
      description: "Prices are test-mode placeholders and must be confirmed by the client before live payments.",
      selfModeLabel: "For myself",
      giftModeLabel: "As a gift",
      purchaserNameLabel: "Your name",
      purchaserEmailLabel: "Your email",
      recipientNameLabel: "Recipient name",
      recipientMessageLabel: "Short message",
      recipientEmailLabel: "Recipient email",
      deliveryBuyerOnlyLabel: "I will send the certificate myself",
      deliveryRecipientEmailLabel: "Send to recipient automatically",
      serviceLabel: "Massage",
      sessionsLabel: "Number of sessions",
      addMassageAction: "+ Add massage",
      removeMassageAction: "Remove",
      amountTitle: "Free amount",
      customAmountLabel: "Custom amount in EUR",
      totalLabel: "Total",
      bgnEquivalentLabel: "BGN equivalent until 8 August 2026",
      validityNotice: "Validity: 6 months.",
      validityConfirmationNotice: "Valid for 6 months from the purchase date.",
      paymentSectionTitle: "Payment",
      paymentPrivacyNotice:
        "Card details are processed by Stripe. Magic Massage Natali does not store card numbers, CVC or financial data.",
      demoPaymentNotice: "Demo/test mode: real payments are not accepted without final prices and the live flag enabled.",
      payAction: "Pay for certificate",
      preparingPayment: "Preparing payment...",
      paymentSuccess: "Payment succeeded. The certificate will be sent by email.",
      paymentError: "Payment was not completed. Please try again.",
    },
  },
};

const deliverySectionLabels: Record<Locale, string> = {
  bg: "Начин на доставка на сертификата",
  ru: "Как отправить сертификат",
  ua: "Як надіслати сертифікат",
  en: "Choose certificate delivery",
};

function getLocalizedServiceOptions(locale: Locale): GiftCertificateServiceFormOption[] {
  return giftCertificateServiceSlugs.map((slug) => {
    const definition = getGiftCertificateServiceDefinition(slug);

    return {
      slug,
      title: definition?.titles[locale] ?? slug,
      priceEur: giftCertificateSalesConfig.sellableServices[slug].priceEur,
    };
  });
}

export function getGiftCertificatesPageContent(locale: Locale): GiftCertificatesPageContent {
  return {
    ...localizedCopy[locale],
    form: {
      ...localizedCopy[locale].form,
      deliverySectionLabel: deliverySectionLabels[locale],
      services: getLocalizedServiceOptions(locale),
      sessionOptions: giftCertificateSalesConfig.sessionOptions,
      quickAmountValuesEur: giftCertificateSalesConfig.quickAmountValuesEur,
      amountMinEur: giftCertificateSalesConfig.amountVoucher.minEur,
      amountMaxEur: giftCertificateSalesConfig.amountVoucher.maxEur,
    },
  };
}
