import type { Locale } from "@/i18n/config";

export type ServiceCategory = "massage" | "partial" | "spa";

export type ServiceDefinition = {
  slug: string;
  category: ServiceCategory;
  image: string;
  titles: Record<Locale, string>;
  descriptions: Record<Locale, string>;
};

export const serviceCategoryLabels: Record<Locale, Record<ServiceCategory, string>> = {
  bg: {
    massage: "Масажи",
    partial: "Частични масажи",
    spa: "SPA процедури",
  },
  ru: {
    massage: "Массажи",
    partial: "Частичные массажи",
    spa: "SPA процедуры",
  },
  ua: {
    massage: "Масажі",
    partial: "Часткові масажі",
    spa: "SPA процедури",
  },
  en: {
    massage: "Massages",
    partial: "Partial massages",
    spa: "SPA treatments",
  },
};

export const serviceDefinitions: ServiceDefinition[] = [
  {
    slug: "classic-massage",
    category: "massage",
    image: "/media/services/classic-massage.jpg",
    titles: {
      bg: "Класически масаж",
      ru: "Классический массаж",
      ua: "Класичний масаж",
      en: "Classic massage",
    },
    descriptions: {
      bg: "Балансиран масаж за отпускане, тонус и общо възстановяване на тялото.",
      ru: "Сбалансированный массаж для расслабления, тонуса и общего восстановления тела.",
      ua: "Збалансований масаж для розслаблення, тонусу та загального відновлення тіла.",
      en: "Balanced massage for relaxation, tone and overall body recovery.",
    },
  },
  {
    slug: "deep-tissue-massage",
    category: "massage",
    image: "/media/services/deep-tissue-massage.jpg",
    titles: {
      bg: "Дълбокотъканен масаж",
      ru: "Глубокотканный массаж",
      ua: "Глибокотканинний масаж",
      en: "Deep tissue massage",
    },
    descriptions: {
      bg: "Интензивна работа с дълбоки мускулни слоеве при напрежение и скованост.",
      ru: "Интенсивная работа с глубокими мышечными слоями при напряжении и скованности.",
      ua: "Інтенсивна робота з глибокими м'язовими шарами при напруженні та скутості.",
      en: "Focused work with deeper muscle layers for tension and stiffness.",
    },
  },
  {
    slug: "lymphatic-drainage-massage",
    category: "massage",
    image: "/media/services/lymphatic-drainage-massage.jpg",
    titles: {
      bg: "Лимфодренажен масаж",
      ru: "Лимфодренажный массаж",
      ua: "Лімфодренажний масаж",
      en: "Lymphatic drainage massage",
    },
    descriptions: {
      bg: "Нежни ритмични техники за подпомагане на лекотата и естествения лимфен поток.",
      ru: "Мягкие ритмичные техники для ощущения легкости и поддержки естественного лимфотока.",
      ua: "М'які ритмічні техніки для відчуття легкості та підтримки природного лімфотоку.",
      en: "Gentle rhythmic techniques that support lightness and natural lymph flow.",
    },
  },
  {
    slug: "anti-cellulite-massage",
    category: "massage",
    image: "/media/services/anti-cellulite-massage.jpg",
    titles: {
      bg: "Антицелулитен масаж",
      ru: "Антицеллюлитный массаж",
      ua: "Антицелюлітний масаж",
      en: "Anti-cellulite massage",
    },
    descriptions: {
      bg: "Целенасочени техники за тонус, стягане и работа с проблемни зони.",
      ru: "Направленные техники для тонуса, подтяжки и работы с проблемными зонами.",
      ua: "Спрямовані техніки для тонусу, підтягнення та роботи з проблемними зонами.",
      en: "Targeted techniques for tone, firming and work with specific body zones.",
    },
  },
  {
    slug: "thai-massage",
    category: "massage",
    image: "/media/services/thai-massage.jpg",
    titles: {
      bg: "Тайландски масаж",
      ru: "Тайский массаж",
      ua: "Тайський масаж",
      en: "Thai massage",
    },
    descriptions: {
      bg: "Разтягания и натиск за подвижност, освобождаване на напрежение и усещане за лекота.",
      ru: "Растяжения и давление для подвижности, снятия напряжения и ощущения легкости.",
      ua: "Розтягування й тиск для рухливості, зняття напруження та відчуття легкості.",
      en: "Stretching and pressure for mobility, tension release and a lighter body feeling.",
    },
  },
  {
    slug: "smart-therapy",
    category: "massage",
    image: "/media/services/smart-therapy.jpg",
    titles: {
      bg: "Смарт терапия",
      ru: "Смарт терапия",
      ua: "Смарт терапія",
      en: "Smart therapy",
    },
    descriptions: {
      bg: "Индивидуално подбрана терапия според състоянието, зоните на напрежение и целите.",
      ru: "Индивидуально подобранная терапия по состоянию, зонам напряжения и целям.",
      ua: "Індивідуально підібрана терапія за станом, зонами напруження та цілями.",
      en: "Individually selected therapy based on your condition, tension zones and goals.",
    },
  },
  {
    slug: "modeling-massage",
    category: "massage",
    image: "/media/services/belly-massage.jpg",
    titles: {
      bg: "Моделиращ масаж",
      ru: "Моделирующий массаж",
      ua: "Моделюючий масаж",
      en: "Modeling massage",
    },
    descriptions: {
      bg: "Активна работа за оформяне, тонус и по-стегнато усещане в тялото.",
      ru: "Активная работа для моделирования, тонуса и более подтянутого ощущения тела.",
      ua: "Активна робота для моделювання, тонусу та більш підтягнутого відчуття тіла.",
      en: "Active work for shaping, tone and a firmer body feeling.",
    },
  },
  {
    slug: "reflexology",
    category: "massage",
    image: "/media/services/reflexology.jpg",
    titles: {
      bg: "Рефлексотерапия",
      ru: "Рефлексотерапия",
      ua: "Рефлексотерапія",
      en: "Reflexology",
    },
    descriptions: {
      bg: "Работа по рефлексни точки за отпускане, баланс и усещане за възстановяване.",
      ru: "Работа по рефлекторным точкам для расслабления, баланса и восстановления.",
      ua: "Робота з рефлекторними точками для розслаблення, балансу та відновлення.",
      en: "Work with reflex points for relaxation, balance and a restored feeling.",
    },
  },
  {
    slug: "face-massage",
    category: "massage",
    image: "/media/services/face-massage.jpg",
    titles: {
      bg: "Масаж на лице",
      ru: "Массаж лица",
      ua: "Масаж обличчя",
      en: "Face massage",
    },
    descriptions: {
      bg: "Деликатни техники за отпускане на лицето, свежест и по-спокойно излъчване.",
      ru: "Деликатные техники для расслабления лица, свежести и более спокойного вида.",
      ua: "Делікатні техніки для розслаблення обличчя, свіжості та спокійнішого вигляду.",
      en: "Delicate techniques for facial relaxation, freshness and a calmer look.",
    },
  },
  {
    slug: "bms-apparatus-massage",
    category: "massage",
    image: "/media/services/bms-apparatus-massage.jpg",
    titles: {
      bg: "Апаратен масаж с биомеханична стимулация (BMS)",
      ru: "Аппаратный массаж с биомеханической стимуляцией (BMS)",
      ua: "Апаратний масаж з біомеханічною стимуляцією (BMS)",
      en: "Apparatus massage with biomechanical stimulation (BMS)",
    },
    descriptions: {
      bg: "Апаратна техника за стимулиране на тъканите, тонус и възстановяващо усещане.",
      ru: "Аппаратная техника для стимуляции тканей, тонуса и восстановительного эффекта.",
      ua: "Апаратна техніка для стимуляції тканин, тонусу та відновлювального ефекту.",
      en: "An apparatus technique for tissue stimulation, tone and a restorative feeling.",
    },
  },
  {
    slug: "cupping-therapy",
    category: "massage",
    image: "/media/services/cupping-therapy.jpg",
    titles: {
      bg: "Банкова терапия",
      ru: "Баночная терапия",
      ua: "Банкова терапія",
      en: "Cupping therapy",
    },
    descriptions: {
      bg: "Терапия с вендузи като допълваща техника за отпускане и стимулиране на тъканите.",
      ru: "Терапия банками как дополнительная техника для расслабления и стимуляции тканей.",
      ua: "Терапія банками як додаткова техніка для розслаблення та стимуляції тканин.",
      en: "Cupping as an additional technique for tissue release and stimulation.",
    },
  },
  {
    slug: "back-massage",
    category: "partial",
    image: "/media/services/back-massage.jpg",
    titles: {
      bg: "Масаж на гръб",
      ru: "Массаж спины",
      ua: "Масаж спини",
      en: "Back massage",
    },
    descriptions: {
      bg: "Фокусиран масаж за гръб при напрежение, умора и усещане за скованост.",
      ru: "Фокусированный массаж спины при напряжении, усталости и ощущении скованности.",
      ua: "Фокусований масаж спини при напруженні, втомі та відчутті скутості.",
      en: "Focused back massage for tension, fatigue and stiffness.",
    },
  },
  {
    slug: "neck-shoulders-massage",
    category: "partial",
    image: "/media/services/neck-shoulders-massage.jpg",
    titles: {
      bg: "Масаж на врат и рамене",
      ru: "Массаж шеи и плеч",
      ua: "Масаж шиї та плечей",
      en: "Neck and shoulders massage",
    },
    descriptions: {
      bg: "Кратък целеви масаж за зона, която често задържа стрес и напрежение.",
      ru: "Короткий целевой массаж зоны, где часто накапливаются стресс и напряжение.",
      ua: "Короткий цільовий масаж зони, де часто накопичуються стрес і напруження.",
      en: "A short targeted massage for an area that often holds stress and tension.",
    },
  },
  {
    slug: "head-massage",
    category: "partial",
    image: "/media/services/head-massage.jpg",
    titles: {
      bg: "Масаж на глава",
      ru: "Массаж головы",
      ua: "Масаж голови",
      en: "Head massage",
    },
    descriptions: {
      bg: "Успокояващи техники за глава, скалп и усещане за психическо отпускане.",
      ru: "Успокаивающие техники для головы, кожи головы и ощущения ментального отдыха.",
      ua: "Заспокійливі техніки для голови, шкіри голови та відчуття ментального відпочинку.",
      en: "Calming techniques for the head, scalp and mental relaxation.",
    },
  },
  {
    slug: "belly-massage",
    category: "partial",
    image: "/media/services/modeling-massage.jpg",
    titles: {
      bg: "Масаж на корем",
      ru: "Массаж живота",
      ua: "Масаж живота",
      en: "Belly massage",
    },
    descriptions: {
      bg: "Деликатна работа в зоната на корема за комфорт и усещане за лекота.",
      ru: "Деликатная работа в зоне живота для комфорта и ощущения легкости.",
      ua: "Делікатна робота в зоні живота для комфорту та відчуття легкості.",
      en: "Delicate work around the belly area for comfort and lightness.",
    },
  },
  {
    slug: "legs-massage",
    category: "partial",
    image: "/media/services/legs-massage.jpg",
    titles: {
      bg: "Масаж на крака",
      ru: "Массаж ног",
      ua: "Масаж ніг",
      en: "Legs massage",
    },
    descriptions: {
      bg: "Фокусиран масаж за уморени крака, тежест и нужда от отпускане.",
      ru: "Фокусированный массаж для уставших ног, тяжести и потребности в расслаблении.",
      ua: "Фокусований масаж для втомлених ніг, важкості та потреби в розслабленні.",
      en: "Focused massage for tired legs, heaviness and the need to relax.",
    },
  },
  {
    slug: "hot-stone-therapy",
    category: "spa",
    image: "/media/services/hot-stone-therapy.jpg",
    titles: {
      bg: "Хот стоун терапия",
      ru: "Хот стоун терапия",
      ua: "Хот стоун терапія",
      en: "Hot stone therapy",
    },
    descriptions: {
      bg: "Терапия с горещи камъни за дълбоко затопляне, отпускане и комфорт.",
      ru: "Терапия горячими камнями для глубокого прогревания, расслабления и комфорта.",
      ua: "Терапія гарячим камінням для глибокого прогрівання, розслаблення та комфорту.",
      en: "Hot stone therapy for deep warmth, relaxation and comfort.",
    },
  },
  {
    slug: "phytosauna",
    category: "spa",
    image: "/media/services/phytosauna.jpg",
    titles: {
      bg: "Фитосауна",
      ru: "Фитосауна",
      ua: "Фітосауна",
      en: "Phytosauna",
    },
    descriptions: {
      bg: "Затопляща SPA процедура с билкова атмосфера за отпускане и тонус.",
      ru: "Согревающая SPA процедура с травяной атмосферой для расслабления и тонуса.",
      ua: "Зігрівальна SPA процедура з трав'яною атмосферою для розслаблення та тонусу.",
      en: "A warming SPA treatment with a herbal atmosphere for relaxation and tone.",
    },
  },
  {
    slug: "body-wrap",
    category: "spa",
    image: "/media/services/body-wrap.jpg",
    titles: {
      bg: "Обвиване на тяло",
      ru: "Обертывание тела",
      ua: "Обгортання тіла",
      en: "Body wrap",
    },
    descriptions: {
      bg: "SPA грижа с обвиване за комфорт, мекота на кожата и усещане за лекота.",
      ru: "SPA уход с обертыванием для комфорта, мягкости кожи и ощущения легкости.",
      ua: "SPA догляд з обгортанням для комфорту, м'якості шкіри та відчуття легкості.",
      en: "SPA body wrap care for comfort, softer skin and a lighter feeling.",
    },
  },
];

const altPrefixes: Record<Locale, string> = {
  bg: "Масажна процедура",
  ru: "Массажная процедура",
  ua: "Масажна процедура",
  en: "Massage treatment",
};

export function buildServices(locale: Locale) {
  return serviceDefinitions.map((service) => ({
    slug: service.slug,
    category: service.category,
    title: service.titles[locale],
    description: service.descriptions[locale],
    image: service.image,
    imageAlt: `${altPrefixes[locale]}: ${service.titles[locale]}`,
  }));
}
