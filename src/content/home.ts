import type { Locale } from "@/i18n/config";

export type HomeContent = {
  brand: string;
  navigation: {
    home: string;
    services: string;
    about: string;
    blog: string;
    contacts: string;
    booking: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryAction: string;
    secondaryAction: string;
  };
  services: {
    eyebrow: string;
    title: string;
    description: string;
    action: string;
    items: Array<{ title: string; description: string; image: string }>;
  };
  about: {
    eyebrow: string;
    title: string;
    description: string;
    points: string[];
  };
  trust: Array<{ value: string; label: string }>;
  booking: {
    eyebrow: string;
    title: string;
    description: string;
    action: string;
  };
  contact: {
    eyebrow: string;
    title: string;
    addressLabel: string;
    address: string;
    phoneLabel: string;
    phone: string;
    hoursLabel: string;
    hours: string;
  };
};

const sharedImages = {
  classic: "/media/services/classic-massage.jpg",
  relaxing: "/media/services/relaxing-neck-massage.jpg",
  deepTissue: "/media/services/deep-tissue-massage.jpg",
};

const content: Record<Locale, HomeContent> = {
  bg: {
    brand: "Magic Massage Natali",
    navigation: {
      home: "Начало",
      services: "Масажи",
      about: "За мен",
      blog: "Блог",
      contacts: "Контакти",
      booking: "Запази час",
    },
    hero: {
      eyebrow: "Масажно студио в Бургас",
      title: "Грижа за тялото. Спокойствие за ума.",
      description:
        "Персонален масаж в уютна атмосфера, съобразен с Вашето състояние, ритъм и цели.",
      primaryAction: "Запази час",
      secondaryAction: "Разгледай масажите",
    },
    services: {
      eyebrow: "Подбрани процедури",
      title: "Масаж според нуждите на Вашето тяло",
      description:
        "От дълбоко отпускане до целенасочена работа върху напрежението и умората.",
      action: "Виж всички масажи",
      items: [
        {
          title: "Класически масаж",
          description: "Балансирана грижа за тонус, движение и общо възстановяване.",
          image: sharedImages.classic,
        },
        {
          title: "Релаксиращ масаж",
          description: "Плавни техники за освобождаване от стрес и дълбоко отпускане.",
          image: sharedImages.relaxing,
        },
        {
          title: "Дълбокотъканен масаж",
          description: "Фокусирана работа при натрупано мускулно напрежение.",
          image: sharedImages.deepTissue,
        },
      ],
    },
    about: {
      eyebrow: "За Натали",
      title: "Внимателен подход към всеки човек",
      description:
        "Всеки сеанс започва с кратък разговор и се адаптира към Вашия комфорт. Целта е да си тръгнете по-леки, спокойни и с усещане за истинска грижа.",
      points: ["Индивидуален подход", "Уютно студио", "Лесно онлайн записване"],
    },
    trust: [
      { value: "1:1", label: "лично внимание" },
      { value: "3", label: "езика за записване" },
      { value: "Бургас", label: "удобна локация" },
    ],
    booking: {
      eyebrow: "Вашето време за почивка",
      title: "Изберете масаж и изпратете заявка за удобен час",
      description:
        "Натали ще потвърди часа лично. При нужда ще получите предложение за най-близкия свободен час.",
      action: "Запази час",
    },
    contact: {
      eyebrow: "Посетете студиото",
      title: "Magic Massage Natali в Бургас",
      addressLabel: "Адрес",
      address: "ул. „Места“ 49, Бургас",
      phoneLabel: "Телефон",
      phone: "+359 89 677 8309",
      hoursLabel: "Работно време",
      hours: "С предварително записване",
    },
  },
  ru: {
    brand: "Magic Massage Natali",
    navigation: {
      home: "Главная",
      services: "Массажи",
      about: "Обо мне",
      blog: "Блог",
      contacts: "Контакты",
      booking: "Записаться",
    },
    hero: {
      eyebrow: "Массажный салон в Бургасе",
      title: "Забота о теле. Спокойствие для души.",
      description:
        "Персональный массаж в уютной атмосфере, подобранный с учетом вашего состояния, ритма и целей.",
      primaryAction: "Записаться",
      secondaryAction: "Посмотреть массажи",
    },
    services: {
      eyebrow: "Избранные процедуры",
      title: "Массаж в соответствии с потребностями вашего тела",
      description:
        "От глубокого расслабления до направленной работы с напряжением и усталостью.",
      action: "Все виды массажа",
      items: [
        {
          title: "Классический массаж",
          description: "Сбалансированная забота о тонусе, движении и восстановлении.",
          image: sharedImages.classic,
        },
        {
          title: "Расслабляющий массаж",
          description: "Плавные техники для снятия стресса и глубокого расслабления.",
          image: sharedImages.relaxing,
        },
        {
          title: "Глубокий массаж тканей",
          description: "Направленная работа с накопившимся мышечным напряжением.",
          image: sharedImages.deepTissue,
        },
      ],
    },
    about: {
      eyebrow: "О Натали",
      title: "Внимательный подход к каждому человеку",
      description:
        "Каждый сеанс начинается с короткой беседы и адаптируется под ваш комфорт. Важно, чтобы после массажа вы чувствовали легкость, спокойствие и настоящую заботу.",
      points: ["Индивидуальный подход", "Уютный салон", "Удобная онлайн-запись"],
    },
    trust: [
      { value: "1:1", label: "личное внимание" },
      { value: "3", label: "языка для записи" },
      { value: "Бургас", label: "удобное расположение" },
    ],
    booking: {
      eyebrow: "Ваше время для отдыха",
      title: "Выберите массаж и отправьте заявку на удобное время",
      description:
        "Натали лично подтвердит запись. Если время занято, вы получите ближайший доступный вариант.",
      action: "Записаться",
    },
    contact: {
      eyebrow: "Посетите салон",
      title: "Magic Massage Natali в Бургасе",
      addressLabel: "Адрес",
      address: "ул. «Места» 49, Бургас",
      phoneLabel: "Телефон",
      phone: "+359 89 677 8309",
      hoursLabel: "Время работы",
      hours: "По предварительной записи",
    },
  },
  ua: {
    brand: "Magic Massage Natali",
    navigation: {
      home: "Головна",
      services: "Масажі",
      about: "Про мене",
      blog: "Блог",
      contacts: "Контакти",
      booking: "Записатися",
    },
    hero: {
      eyebrow: "Масажний салон у Бургасі",
      title: "Турбота про тіло. Спокій для душі.",
      description:
        "Персональний масаж у затишній атмосфері, підібраний з урахуванням вашого стану, ритму та цілей.",
      primaryAction: "Записатися",
      secondaryAction: "Переглянути масажі",
    },
    services: {
      eyebrow: "Обрані процедури",
      title: "Масаж відповідно до потреб вашого тіла",
      description:
        "Від глибокого розслаблення до цілеспрямованої роботи з напруженням і втомою.",
      action: "Усі види масажу",
      items: [
        {
          title: "Класичний масаж",
          description: "Збалансована турбота про тонус, рухливість і відновлення.",
          image: sharedImages.classic,
        },
        {
          title: "Розслаблювальний масаж",
          description: "Плавні техніки для зняття стресу та глибокого відпочинку.",
          image: sharedImages.relaxing,
        },
        {
          title: "Глибокий масаж тканин",
          description: "Цілеспрямована робота з накопиченим м'язовим напруженням.",
          image: sharedImages.deepTissue,
        },
      ],
    },
    about: {
      eyebrow: "Про Наталі",
      title: "Уважний підхід до кожної людини",
      description:
        "Кожен сеанс починається з короткої розмови та адаптується до вашого комфорту. Важливо, щоб після масажу ви відчували легкість, спокій і справжню турботу.",
      points: ["Індивідуальний підхід", "Затишний салон", "Зручний онлайн-запис"],
    },
    trust: [
      { value: "1:1", label: "особиста увага" },
      { value: "3", label: "мови для запису" },
      { value: "Бургас", label: "зручне розташування" },
    ],
    booking: {
      eyebrow: "Ваш час для відпочинку",
      title: "Оберіть масаж і надішліть заявку на зручний час",
      description:
        "Наталі особисто підтвердить запис. Якщо час зайнятий, ви отримаєте найближчий доступний варіант.",
      action: "Записатися",
    },
    contact: {
      eyebrow: "Відвідайте салон",
      title: "Magic Massage Natali у Бургасі",
      addressLabel: "Адреса",
      address: "вул. «Места» 49, Бургас",
      phoneLabel: "Телефон",
      phone: "+359 89 677 8309",
      hoursLabel: "Години роботи",
      hours: "За попереднім записом",
    },
  },
};

export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}
