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
      title: "Лично внимание в спокойна и дискретна атмосфера",
      lead: "Magic Massage Natali е малко студио в Бургас, създадено за индивидуална грижа без бързане.",
      paragraphs: [
        "Всеки сеанс започва с кратък разговор за Вашето състояние, предпочитания и зони на напрежение. Интензивността и ритъмът се адаптират към комфорта Ви.",
        "Пространството е организирано така, че да осигури спокойствие, чистота и лично отношение от пристигането до края на посещението.",
      ],
      values: ["Индивидуален подход", "Внимание към комфорта", "Спокойна атмосфера", "Лична комуникация"],
      imageAlt: "Натали по време на масажна процедура",
      studioImageAlt: "Подаръчен ваучер за масаж в Magic Massage Natali",
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
      title: "Массажи для восстановления, легкости и спокойного ритма",
      description: "Выберите подходящий уход с учетом вашего комфорта, нагрузки и желаемого ощущения после сеанса.",
      bookingAction: "Записаться",
      categoryLabels: serviceCategoryLabels.ru,
      items: buildServices("ru"),
    },
    about: {
      eyebrow: "О Натали и салоне",
      title: "Личное внимание в спокойной и деликатной атмосфере",
      lead: "Magic Massage Natali — небольшой салон в Бургасе, созданный для индивидуального ухода без спешки.",
      paragraphs: [
        "Каждый сеанс начинается с короткой беседы о вашем самочувствии, предпочтениях и зонах напряжения. Интенсивность и ритм подбираются с учетом вашего комфорта.",
        "Пространство организовано так, чтобы обеспечить спокойствие, чистоту и личное отношение с момента прихода до завершения визита.",
      ],
      values: ["Индивидуальный подход", "Внимание к комфорту", "Спокойная атмосфера", "Личное общение"],
      imageAlt: "Натали во время массажной процедуры",
      studioImageAlt: "Подарочный ваучер на массаж в Magic Massage Natali",
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
      title: "Особиста увага у спокійній та делікатній атмосфері",
      lead: "Magic Massage Natali — невеликий салон у Бургасі, створений для індивідуального догляду без поспіху.",
      paragraphs: [
        "Кожен сеанс починається з короткої розмови про ваше самопочуття, побажання та зони напруження. Інтенсивність і ритм добираються з урахуванням вашого комфорту.",
        "Простір організовано так, щоб забезпечити спокій, чистоту та особисте ставлення від моменту приходу до завершення візиту.",
      ],
      values: ["Індивідуальний підхід", "Увага до комфорту", "Спокійна атмосфера", "Особисте спілкування"],
      imageAlt: "Наталі під час масажної процедури",
      studioImageAlt: "Подарунковий ваучер на масаж у Magic Massage Natali",
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
      title: "Personal attention in a calm and discreet atmosphere",
      lead: "Magic Massage Natali is a small massage studio in Burgas created for individual care without rush.",
      paragraphs: [
        "Each session starts with a short conversation about how you feel, your preferences and areas of tension. Intensity and rhythm are adapted to your comfort.",
        "The studio is arranged to provide calm, cleanliness and personal attention from the moment you arrive until the end of the visit.",
      ],
      values: ["Individual approach", "Attention to comfort", "Calm atmosphere", "Personal communication"],
      imageAlt: "Natali during a massage treatment",
      studioImageAlt: "Massage gift voucher at Magic Massage Natali",
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
