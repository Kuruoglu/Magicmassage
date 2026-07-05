import {
  buildServices,
  serviceCategoryLabels,
  type ServiceCategory,
} from "@/content/service-catalog";
import type { Locale } from "@/i18n/config";

export type ServiceContent = {
  slug: string;
  category: ServiceCategory;
  title: string;
  description: string;
  detailParagraphs: string[];
  image: string;
  imageAlt: string;
};

export type PublicPagesContent = {
  services: {
    eyebrow: string;
    title: string;
    description: string;
    bookingAction: string;
    categoryLabels: Record<ServiceCategory, string>;
    items: ServiceContent[];
  };
  about: {
    eyebrow: string;
    title: string;
    lead: string;
    paragraphs: [string, string];
    values: string[];
    imageAlt: string;
    studioImageAlt: string;
    certificates: {
      eyebrow: string;
      title: string;
      description: string;
      viewerLabel: string;
      openLabel: string;
      closeLabel: string;
      previousLabel: string;
      nextLabel: string;
      items: CertificateContent[];
    };
  };
  contacts: {
    eyebrow: string;
    title: string;
    description: string;
    addressLabel: string;
    address: string;
    phoneLabel: string;
    phone: string;
    hoursLabel: string;
    hours: string;
    callAction: string;
    directionsAction: string;
    mapTitle: string;
    mapDescription: string;
  };
};

type CertificateSlug =
  | "body-chiromassage"
  | "chiromassage-face"
  | "lymphatic-partner-plus"
  | "massage-therapist"
  | "thai-massage"
  | "professional-training-bg"
  | "kinesiology-taping"
  | "charm-device";

export type CertificateContent = {
  slug: CertificateSlug;
  caption: string;
  alt: string;
  image: {
    src: string;
    width: number;
    height: number;
    orientation: "landscape" | "portrait";
  };
};

const certificateOrder: CertificateSlug[] = [
  "body-chiromassage",
  "chiromassage-face",
  "lymphatic-partner-plus",
  "massage-therapist",
  "thai-massage",
  "professional-training-bg",
  "kinesiology-taping",
  "charm-device",
];

const certificateImages: Record<CertificateSlug, CertificateContent["image"]> = {
  "body-chiromassage": {
    src: "/media/about/certificates/09-body-chiromassage.webp",
    width: 979,
    height: 718,
    orientation: "landscape",
  },
  "chiromassage-face": {
    src: "/media/about/certificates/01-chiromassage-face.webp",
    width: 995,
    height: 707,
    orientation: "landscape",
  },
  "lymphatic-partner-plus": {
    src: "/media/about/certificates/03-lymphatic-partner-plus.webp",
    width: 962,
    height: 717,
    orientation: "landscape",
  },
  "massage-therapist": {
    src: "/media/about/certificates/04-massage-therapist.webp",
    width: 981,
    height: 708,
    orientation: "landscape",
  },
  "thai-massage": {
    src: "/media/about/certificates/07-thai-massage.webp",
    width: 726,
    height: 979,
    orientation: "portrait",
  },
  "professional-training-bg": {
    src: "/media/about/certificates/05-professional-training-bg.webp",
    width: 710,
    height: 980,
    orientation: "portrait",
  },
  "kinesiology-taping": {
    src: "/media/about/certificates/06-kinesiology-taping.webp",
    width: 706,
    height: 978,
    orientation: "portrait",
  },
  "charm-device": {
    src: "/media/about/certificates/02-charm-device.webp",
    width: 916,
    height: 670,
    orientation: "landscape",
  },
};

const certificateCopy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    description: string;
    viewerLabel: string;
    openLabel: string;
    closeLabel: string;
    previousLabel: string;
    nextLabel: string;
    items: Record<CertificateSlug, { caption: string; alt: string }>;
  }
> = {
  bg: {
    eyebrow: "Професионална основа",
    title: "Сертификати на Натали",
    description:
      "Документите показват обученията и масажните направления, които Натали прилага внимателно в работата си в студиото.",
    viewerLabel: "Преглед на сертификат",
    openLabel: "Отвори сертификата",
    closeLabel: "Затвори",
    previousLabel: "Предишен сертификат",
    nextLabel: "Следващ сертификат",
    items: {
      "body-chiromassage": {
        caption: "Хиромасаж на тяло",
        alt: "Сертификат на Наталия Бурачек за хиромасаж на тяло по испанска техника.",
      },
      "chiromassage-face": {
        caption: "Хиромасаж на лице",
        alt: "Сертификат на Наталия Бурачек за обучение по хиромасаж на лице.",
      },
      "lymphatic-partner-plus": {
        caption: "Лимфодренажен масаж Partner+",
        alt: "Сертификат на Наталия Бурачек за лимфодренажен масаж Partner+.",
      },
      "massage-therapist": {
        caption: "Massage therapist",
        alt: "Сертификат Massage Therapist на Наталия Бурачек от Partner Plus.",
      },
      "thai-massage": {
        caption: "Тайландски масаж",
        alt: "Сертификат на Наталия Бурачек за обучение по тайландски масаж.",
      },
      "professional-training-bg": {
        caption: "Професионално обучение",
        alt: "Удостоверение на Наталия Бурачек за професионално обучение в Бургас.",
      },
      "kinesiology-taping": {
        caption: "Kinesiology taping",
        alt: "Сертификат на Nataliia Burachek за професионален курс по кинезиологичен тейпинг.",
      },
      "charm-device": {
        caption: "Аппаратни техники Charm",
        alt: "Сертификат на Nataliia Burachek за работа с апаратни масажни техники Charm.",
      },
    },
  },
  ru: {
    eyebrow: "Профессиональная база",
    title: "Сертификаты Натальи",
    description:
      "Документы подтверждают обучение Натальи в массажных техниках, с которыми она работает в студии.",
    viewerLabel: "Просмотр сертификата",
    openLabel: "Открыть сертификат",
    closeLabel: "Закрыть",
    previousLabel: "Предыдущий сертификат",
    nextLabel: "Следующий сертификат",
    items: {
      "body-chiromassage": {
        caption: "Хиромассаж тела",
        alt: "Сертификат Наталии Бурачек по хиромассажу тела в испанской технике.",
      },
      "chiromassage-face": {
        caption: "Хиромассаж лица",
        alt: "Сертификат Наталии Бурачек об обучении по программе хиромассаж лица.",
      },
      "lymphatic-partner-plus": {
        caption: "Лимфодренажный массаж Partner+",
        alt: "Сертификат Наталии Бурачек по лимфодренажному массажу Partner+.",
      },
      "massage-therapist": {
        caption: "Massage therapist",
        alt: "Сертификат Massage Therapist Наталии Бурачек от академии Partner Plus.",
      },
      "thai-massage": {
        caption: "Тайландский массаж",
        alt: "Сертификат Наталии Бурачек по обучению тайландскому массажу.",
      },
      "professional-training-bg": {
        caption: "Профессиональное обучение",
        alt: "Удостоверение Наталии Бурачек о профессиональном обучении в Бургасе.",
      },
      "kinesiology-taping": {
        caption: "Kinesiology taping",
        alt: "Сертификат Nataliia Burachek о прохождении курса по кинезиологическому тейпированию.",
      },
      "charm-device": {
        caption: "Аппаратные техники Charm",
        alt: "Сертификат Nataliia Burachek по массажным техникам на аппаратах Charm.",
      },
    },
  },
  ua: {
    eyebrow: "Професійна основа",
    title: "Сертифікати Наталі",
    description:
      "Документи підтверджують навчання Наталі в масажних техніках, з якими вона працює у студії.",
    viewerLabel: "Перегляд сертифіката",
    openLabel: "Відкрити сертифікат",
    closeLabel: "Закрити",
    previousLabel: "Попередній сертифікат",
    nextLabel: "Наступний сертифікат",
    items: {
      "body-chiromassage": {
        caption: "Хіромасаж тіла",
        alt: "Сертифікат Наталії Бурачек з хіромасажу тіла в іспанській техніці.",
      },
      "chiromassage-face": {
        caption: "Хіромасаж обличчя",
        alt: "Сертифікат Наталії Бурачек про навчання за програмою хіромасаж обличчя.",
      },
      "lymphatic-partner-plus": {
        caption: "Лімфодренажний масаж Partner+",
        alt: "Сертифікат Наталії Бурачек з лімфодренажного масажу Partner+.",
      },
      "massage-therapist": {
        caption: "Massage therapist",
        alt: "Сертифікат Massage Therapist Наталії Бурачек від академії Partner Plus.",
      },
      "thai-massage": {
        caption: "Тайський масаж",
        alt: "Сертифікат Наталії Бурачек про навчання тайському масажу.",
      },
      "professional-training-bg": {
        caption: "Професійне навчання",
        alt: "Посвідчення Наталії Бурачек про професійне навчання в Бургасі.",
      },
      "kinesiology-taping": {
        caption: "Kinesiology taping",
        alt: "Сертифікат Nataliia Burachek про проходження курсу з кінезіологічного тейпування.",
      },
      "charm-device": {
        caption: "Апаратні техніки Charm",
        alt: "Сертифікат Nataliia Burachek з масажних технік на апаратах Charm.",
      },
    },
  },
  en: {
    eyebrow: "Professional foundation",
    title: "Natali's certificates",
    description:
      "These documents show Natali's training in the massage techniques she uses with care in the studio.",
    viewerLabel: "Certificate viewer",
    openLabel: "Open certificate",
    closeLabel: "Close",
    previousLabel: "Previous certificate",
    nextLabel: "Next certificate",
    items: {
      "body-chiromassage": {
        caption: "Body chiromassage",
        alt: "Certificate for Nataliia Burachek in body chiromassage using the Spanish technique.",
      },
      "chiromassage-face": {
        caption: "Face chiromassage",
        alt: "Certificate for Nataliia Burachek for training in face chiromassage.",
      },
      "lymphatic-partner-plus": {
        caption: "Lymphatic drainage massage Partner+",
        alt: "Certificate for Nataliia Burachek in lymphatic drainage massage Partner+.",
      },
      "massage-therapist": {
        caption: "Massage therapist",
        alt: "Massage Therapist certificate for Nataliia Burachek from Partner Plus academy.",
      },
      "thai-massage": {
        caption: "Thai massage",
        alt: "Certificate for Natalia Burachek for training in Thai massage.",
      },
      "professional-training-bg": {
        caption: "Professional training",
        alt: "Professional training certificate for Natalia Burachek issued in Burgas.",
      },
      "kinesiology-taping": {
        caption: "Kinesiology taping",
        alt: "Certificate for Nataliia Burachek for completing a kinesiology taping course.",
      },
      "charm-device": {
        caption: "Charm device techniques",
        alt: "Certificate for Nataliia Burachek in massage techniques on Charm devices.",
      },
    },
  },
};

function buildCertificates(locale: Locale): PublicPagesContent["about"]["certificates"] {
  const copy = certificateCopy[locale];

  return {
    eyebrow: copy.eyebrow,
    title: copy.title,
    description: copy.description,
    viewerLabel: copy.viewerLabel,
    openLabel: copy.openLabel,
    closeLabel: copy.closeLabel,
    previousLabel: copy.previousLabel,
    nextLabel: copy.nextLabel,
    items: certificateOrder.map((slug) => ({
      slug,
      ...copy.items[slug],
      image: certificateImages[slug],
    })),
  };
}

const content: Record<Locale, PublicPagesContent> = {
  bg: {
    services: {
      eyebrow: "Всички процедури",
      title: "Масажи за възстановяване, лекота и спокоен ритъм",
      description: "Изберете подходяща грижа според Вашия комфорт, натоварване и желаното усещане след сеанса.",
      bookingAction: "Запази час",
      categoryLabels: serviceCategoryLabels.bg,
      items: buildServices("bg"),
    },
    about: {
      eyebrow: "За Натали и студиото",
      title: "Magic Massage Natali — 7 години лична грижа чрез масаж в Бургас",
      lead: "В Magic Massage Natali всеки масаж започва с внимание към човека, неговото състояние и нуждите на тялото.",
      paragraphs: [
        "Казвам се Наталия Бурачек. Работя като масажист в Бургас вече 7 години, с повече от 1000 клиенти и над 5000 проведени масажа. Омъжена съм и имам двама прекрасни сина, затова добре знам колко ценни са спокойствието, доверието и времето за възстановяване.",
        "В Magic Massage Natali съчетавам професионални масажни техники, множество сертификати и внимателно отношение към всеки клиент. Преди процедурата уточняваме зоните на напрежение, желаната интензивност и Вашия комфорт, за да получите масаж в Бургас, подбран лично за Вас.",
      ],
      values: ["7 години опит", "1000+ клиенти", "5000+ масажа", "Множество сертификати"],
      imageAlt: "Натали по време на масажна процедура",
      studioImageAlt: "Подаръчен ваучер за масаж в Magic Massage Natali",
      certificates: buildCertificates("bg"),
    },
    contacts: {
      eyebrow: "Посетете студиото",
      title: "Контакти и записване в Magic Massage Natali",
      description: "Свържете се директно, за да изберете процедура и удобно време за посещение.",
      addressLabel: "Адрес",
      address: "ул. „Места“ 49, Бургас",
      phoneLabel: "Телефон",
      phone: "+359 89 677 8309",
      hoursLabel: "Работно време",
      hours: "С предварително записване",
      callAction: "Обадете се",
      directionsAction: "Получи маршрут",
      mapTitle: "Студиото е в Бургас",
      mapDescription: "Картата показва Magic Massage Natali на ул. „Места“ 49. Използвайте бутона за маршрут през Google Maps.",
    },
  },
  ru: {
    services: {
      eyebrow: "Все процедуры",
      title: "Подари себе незабываемый момент заботы",
      description: "Выберите массаж как личный подарок для тела: спокойная атмосфера, внимание к вашим ощущениям и уход, после которого хочется выдохнуть.",
      bookingAction: "Записаться",
      categoryLabels: serviceCategoryLabels.ru,
      items: buildServices("ru"),
    },
    about: {
      eyebrow: "О Натали и салоне",
      title: "Magic Massage Natali — 7 лет личной заботы через массаж в Бургасе",
      lead: "В Magic Massage Natali каждый массаж начинается с внимания к человеку, его состоянию и потребностям тела.",
      paragraphs: [
        "Меня зовут Наталья Бурачек. Я работаю массажистом в Бургасе уже 7 лет: за это время ко мне обратились более 1000 клиентов, а количество проведенных массажей превысило 5000. Я замужем и мама двух прекрасных сыновей, поэтому хорошо понимаю, как важны спокойствие, доверие и время для восстановления.",
        "В Magic Massage Natali я сочетаю профессиональные массажные техники, множество сертификатов и внимательное отношение к каждому клиенту. Перед процедурой мы уточняем зоны напряжения, желаемую интенсивность и ваш комфорт, чтобы массаж в Бургасе был подобран лично под вас.",
      ],
      values: ["7 лет опыта", "1000+ клиентов", "5000+ массажей", "Множество сертификатов"],
      imageAlt: "Натали во время массажной процедуры",
      studioImageAlt: "Подарочный ваучер на массаж в Magic Massage Natali",
      certificates: buildCertificates("ru"),
    },
    contacts: {
      eyebrow: "Посетите салон",
      title: "Контакты и запись в Magic Massage Natali",
      description: "Свяжитесь напрямую, чтобы выбрать процедуру и удобное время посещения.",
      addressLabel: "Адрес",
      address: "ул. «Места» 49, Бургас",
      phoneLabel: "Телефон",
      phone: "+359 89 677 8309",
      hoursLabel: "Время работы",
      hours: "По предварительной записи",
      callAction: "Позвонить",
      directionsAction: "Проложить маршрут",
      mapTitle: "Салон находится в Бургасе",
      mapDescription: "Карта показывает Magic Massage Natali на ул. «Места» 49. Кнопка маршрута откроет Google Maps.",
    },
  },
  ua: {
    services: {
      eyebrow: "Усі процедури",
      title: "Масажі для відновлення, легкості та спокійного ритму",
      description: "Оберіть відповідний догляд з урахуванням вашого комфорту, навантаження та бажаного відчуття після сеансу.",
      bookingAction: "Записатися",
      categoryLabels: serviceCategoryLabels.ua,
      items: buildServices("ua"),
    },
    about: {
      eyebrow: "Про Наталі та салон",
      title: "Magic Massage Natali — 7 років особистої турботи через масаж у Бургасі",
      lead: "У Magic Massage Natali кожен масаж починається з уваги до людини, її стану та потреб тіла.",
      paragraphs: [
        "Мене звати Наталія Бурачек. Я працюю масажистом у Бургасі вже 7 років: за цей час до мене звернулися понад 1000 клієнтів, а кількість проведених масажів перевищила 5000. Я заміжня і мама двох прекрасних синів, тому добре розумію, наскільки важливі спокій, довіра та час для відновлення.",
        "У Magic Massage Natali я поєдную професійні масажні техніки, численні сертифікати та уважне ставлення до кожного клієнта. Перед процедурою ми уточнюємо зони напруження, бажану інтенсивність і ваш комфорт, щоб масаж у Бургасі був підібраний особисто для вас.",
      ],
      values: ["7 років досвіду", "1000+ клієнтів", "5000+ масажів", "Багато сертифікатів"],
      imageAlt: "Наталі під час масажної процедури",
      studioImageAlt: "Подарунковий ваучер на масаж у Magic Massage Natali",
      certificates: buildCertificates("ua"),
    },
    contacts: {
      eyebrow: "Відвідайте салон",
      title: "Контакти та запис у Magic Massage Natali",
      description: "Зв'яжіться безпосередньо, щоб обрати процедуру та зручний час відвідування.",
      addressLabel: "Адреса",
      address: "вул. «Места» 49, Бургас",
      phoneLabel: "Телефон",
      phone: "+359 89 677 8309",
      hoursLabel: "Години роботи",
      hours: "За попереднім записом",
      callAction: "Зателефонувати",
      directionsAction: "Прокласти маршрут",
      mapTitle: "Салон розташований у Бургасі",
      mapDescription: "Карта показує Magic Massage Natali на вул. «Места» 49. Кнопка маршруту відкриє Google Maps.",
    },
  },
  en: {
    services: {
      eyebrow: "All treatments",
      title: "Massages for recovery, lightness and a calmer rhythm",
      description: "Choose the right care for your comfort, daily load and the feeling you want after the session.",
      bookingAction: "Book now",
      categoryLabels: serviceCategoryLabels.en,
      items: buildServices("en"),
    },
    about: {
      eyebrow: "About Natali and the studio",
      title: "Magic Massage Natali — 7 years of personal massage care in Burgas",
      lead: "At Magic Massage Natali, every massage starts with attention to the person, their condition and the needs of the body.",
      paragraphs: [
        "My name is Nataliya Burachek. I have worked as a massage therapist in Burgas for 7 years, welcoming more than 1000 clients and completing over 5000 massage sessions. I am married and a mother of two wonderful sons, so I understand how valuable calm, trust and time for recovery can be.",
        "At Magic Massage Natali, I combine professional massage techniques, many certificates and careful attention to every client. Before the session, we discuss tension areas, preferred intensity and comfort so your massage in Burgas feels personal, precise and calm.",
      ],
      values: ["7 years of experience", "1000+ clients", "5000+ massages", "Many certificates"],
      imageAlt: "Natali during a massage treatment",
      studioImageAlt: "Massage gift voucher at Magic Massage Natali",
      certificates: buildCertificates("en"),
    },
    contacts: {
      eyebrow: "Visit the studio",
      title: "Contacts and booking at Magic Massage Natali",
      description: "Contact the studio directly to choose a treatment and a convenient appointment time.",
      addressLabel: "Address",
      address: "Mesta Street 49, Burgas",
      phoneLabel: "Phone",
      phone: "+359 89 677 8309",
      hoursLabel: "Working hours",
      hours: "By appointment",
      callAction: "Call now",
      directionsAction: "Get directions",
      mapTitle: "The studio is in Burgas",
      mapDescription: "The map shows Magic Massage Natali at Mesta Street 49. The directions button opens Google Maps.",
    },
  },
};

export function getPublicPagesContent(locale: Locale): PublicPagesContent {
  return content[locale];
}

export function getServiceContent(locale: Locale, slug: string): ServiceContent | undefined {
  return getPublicPagesContent(locale).services.items.find((service) => service.slug === slug);
}

export function getServiceSlugs(locale: Locale): string[] {
  return getPublicPagesContent(locale).services.items.map((service) => service.slug);
}
