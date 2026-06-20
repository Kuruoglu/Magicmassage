import type { Locale } from "@/i18n/config";
import { getPublicPagesContent, type ServiceContent } from "@/content/public-pages";

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
    items: ServiceContent[];
  };
  about: {
    eyebrow: string;
    title: string;
    description: string;
    points: string[];
  };
  trust: Array<{
    icon: "access" | "variations" | "professional";
    title: string;
    description: string;
    highlight: string;
    shortLabel: string;
  }>;
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
    hoursSchedule: Array<{
      day: string;
      time: string;
    }>;
  };
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
      items: getPublicPagesContent("bg").services.items.slice(0, 3),
    },
    about: {
      eyebrow: "За Натали",
      title: "Внимателен подход към всеки човек",
      description:
        "Всеки сеанс започва с кратък разговор и се адаптира към Вашия комфорт. Целта е да си тръгнете по-леки, спокойни и с усещане за истинска грижа.",
      points: ["Индивидуален подход", "Уютно студио", "Лесно онлайн записване"],
    },
    trust: [
      {
        icon: "access",
        title: "Достъпност",
        description: "Лесна връзка, удобна локация в Бургас и записване според свободните часове.",
        highlight: "Бургас",
        shortLabel: "удобна локация",
      },
      {
        icon: "variations",
        title: "Вариации масажи",
        description: "Класически, релаксиращ, дълбокотъканен и фокусиран масаж според нуждите.",
        highlight: "11 вида",
        shortLabel: "според нуждите",
      },
      {
        icon: "professional",
        title: "Професионализъм",
        description: "Внимателен подход, чиста среда и работа с уважение към Вашия комфорт.",
        highlight: "лично",
        shortLabel: "с внимание",
      },
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
      hoursSchedule: [
        { day: "Понеделник", time: "10:00 - 19:00" },
        { day: "Вторник", time: "10:00 - 19:00" },
        { day: "Сряда", time: "10:00 - 19:00" },
        { day: "Четвъртък", time: "10:00 - 19:00" },
        { day: "Петък", time: "10:00 - 19:00" },
        { day: "Събота", time: "10:00 - 18:00" },
        { day: "Неделя", time: "почивен ден" },
      ],
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
      items: getPublicPagesContent("ru").services.items.slice(0, 3),
    },
    about: {
      eyebrow: "О Натали",
      title: "Внимательный подход к каждому человеку",
      description:
        "Каждый сеанс начинается с короткой беседы и адаптируется под ваш комфорт. Важно, чтобы после массажа вы чувствовали легкость, спокойствие и настоящую заботу.",
      points: ["Индивидуальный подход", "Уютный салон", "Удобная онлайн-запись"],
    },
    trust: [
      {
        icon: "access",
        title: "Доступность",
        description: "Удобная локация в Бургасе, простая связь и запись на подходящее время.",
        highlight: "Бургас",
        shortLabel: "удобная локация",
      },
      {
        icon: "variations",
        title: "Вариации массажей",
        description: "Классический, расслабляющий, глубокий и локальный массаж под вашу задачу.",
        highlight: "11 видов",
        shortLabel: "под разные цели",
      },
      {
        icon: "professional",
        title: "Профессионализм",
        description: "Внимательный подход, чистая атмосфера и работа с уважением к вашему комфорту.",
        highlight: "лично",
        shortLabel: "с вниманием",
      },
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
      hoursSchedule: [
        { day: "Понедельник", time: "10:00 - 19:00" },
        { day: "Вторник", time: "10:00 - 19:00" },
        { day: "Среда", time: "10:00 - 19:00" },
        { day: "Четверг", time: "10:00 - 19:00" },
        { day: "Пятница", time: "10:00 - 19:00" },
        { day: "Суббота", time: "10:00 - 18:00" },
        { day: "Воскресенье", time: "выходной" },
      ],
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
      items: getPublicPagesContent("ua").services.items.slice(0, 3),
    },
    about: {
      eyebrow: "Про Наталі",
      title: "Уважний підхід до кожної людини",
      description:
        "Кожен сеанс починається з короткої розмови та адаптується до вашого комфорту. Важливо, щоб після масажу ви відчували легкість, спокій і справжню турботу.",
      points: ["Індивідуальний підхід", "Затишний салон", "Зручний онлайн-запис"],
    },
    trust: [
      {
        icon: "access",
        title: "Доступність",
        description: "Зручна локація в Бургасі, простий зв'язок і запис на відповідний час.",
        highlight: "Бургас",
        shortLabel: "зручна локація",
      },
      {
        icon: "variations",
        title: "Варіації масажів",
        description: "Класичний, розслаблювальний, глибокий і локальний масаж під вашу потребу.",
        highlight: "11 видів",
        shortLabel: "під різні цілі",
      },
      {
        icon: "professional",
        title: "Професіоналізм",
        description: "Уважний підхід, чиста атмосфера та робота з повагою до вашого комфорту.",
        highlight: "особисто",
        shortLabel: "з увагою",
      },
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
      hoursSchedule: [
        { day: "Понеділок", time: "10:00 - 19:00" },
        { day: "Вівторок", time: "10:00 - 19:00" },
        { day: "Середа", time: "10:00 - 19:00" },
        { day: "Четвер", time: "10:00 - 19:00" },
        { day: "П'ятниця", time: "10:00 - 19:00" },
        { day: "Субота", time: "10:00 - 18:00" },
        { day: "Неділя", time: "вихідний" },
      ],
    },
  },
  en: {
    brand: "Magic Massage Natali",
    navigation: {
      home: "Home",
      services: "Massages",
      about: "About me",
      blog: "Blog",
      contacts: "Contacts",
      booking: "Book now",
    },
    hero: {
      eyebrow: "Massage studio in Burgas",
      title: "Care for the body. Calm for the mind.",
      description:
        "Personal massage in a calm atmosphere, adapted to your condition, rhythm and goals.",
      primaryAction: "Book now",
      secondaryAction: "Explore massages",
    },
    services: {
      eyebrow: "Selected treatments",
      title: "Massage matched to what your body needs",
      description:
        "From deep relaxation to focused work with tension, tiredness and specific body zones.",
      action: "All massage types",
      items: getPublicPagesContent("en").services.items.slice(0, 3),
    },
    about: {
      eyebrow: "About Natali",
      title: "Attentive care for every person",
      description:
        "Every session begins with a short conversation and is adapted to your comfort. The goal is to leave lighter, calmer and genuinely cared for.",
      points: ["Individual approach", "Cozy studio", "Easy online booking"],
    },
    trust: [
      {
        icon: "access",
        title: "Accessibility",
        description: "A convenient location in Burgas, easy contact and booking for a suitable time.",
        highlight: "Burgas",
        shortLabel: "convenient location",
      },
      {
        icon: "variations",
        title: "Massage variations",
        description: "Classic, relaxing, deep tissue and focused massage options for different goals.",
        highlight: "11 types",
        shortLabel: "for different needs",
      },
      {
        icon: "professional",
        title: "Professional care",
        description: "A thoughtful approach, clean atmosphere and work with respect for your comfort.",
        highlight: "personal",
        shortLabel: "with attention",
      },
    ],
    booking: {
      eyebrow: "Your time to rest",
      title: "Choose a massage and send a request for a convenient time",
      description:
        "Natali will personally confirm the booking. If the selected time is busy, you will receive the nearest available option.",
      action: "Book now",
    },
    contact: {
      eyebrow: "Visit the studio",
      title: "Magic Massage Natali in Burgas",
      addressLabel: "Address",
      address: "Mesta Street 49, Burgas",
      phoneLabel: "Phone",
      phone: "+359 89 677 8309",
      hoursLabel: "Working hours",
      hours: "By appointment",
      hoursSchedule: [
        { day: "Monday", time: "10:00 - 19:00" },
        { day: "Tuesday", time: "10:00 - 19:00" },
        { day: "Wednesday", time: "10:00 - 19:00" },
        { day: "Thursday", time: "10:00 - 19:00" },
        { day: "Friday", time: "10:00 - 19:00" },
        { day: "Saturday", time: "10:00 - 18:00" },
        { day: "Sunday", time: "closed" },
      ],
    },
  },
};

export function getHomeContent(locale: Locale): HomeContent {
  return content[locale];
}
