import type { Locale } from "@/i18n/config";

type BlogCopy = {
  articleFallbackDescription: string;
  authorLabel: string;
  backToBlog: string;
  blogTitle: string;
  dateLocale: string;
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  fallbackNotice: string;
  intro: string;
  notFoundDescription: string;
  notFoundTitle: string;
  readArticle: string;
  tagsLabel: string;
};

type BlogCopyLocale = Locale | "de";

const copyByLocale: Record<BlogCopyLocale, BlogCopy> = {
  bg: {
    articleFallbackDescription: "Статия от Magic Massage Natali за масаж, възстановяване и грижа за тялото.",
    authorLabel: "Автор",
    backToBlog: "Към всички статии",
    blogTitle: "Блог",
    dateLocale: "bg-BG",
    emptyDescription: "Подготвяме първите материали. Публикуваните статии ще се появят тук.",
    emptyTitle: "Все още няма публикации",
    eyebrow: "Полезно от Натали",
    fallbackNotice: "Показана е наличната версия на друг език.",
    intro: "Практични материали за масаж, възстановяване и ежедневна грижа за тялото.",
    notFoundDescription: "Тази статия не е публикувана или адресът вече не е актуален.",
    notFoundTitle: "Статията не е намерена",
    readArticle: "Прочетете статията",
    tagsLabel: "Теми",
  },
  ru: {
    articleFallbackDescription: "Статья Magic Massage Natali о массаже, восстановлении и заботе о теле.",
    authorLabel: "Автор",
    backToBlog: "Ко всем статьям",
    blogTitle: "Блог",
    dateLocale: "ru-RU",
    emptyDescription: "Мы готовим первые материалы. Опубликованные статьи появятся здесь.",
    emptyTitle: "Публикаций пока нет",
    eyebrow: "Полезное от Натали",
    fallbackNotice: "Показана доступная версия на другом языке.",
    intro: "Практические материалы о массаже, восстановлении и ежедневной заботе о теле.",
    notFoundDescription: "Эта статья не опубликована или ее адрес больше не актуален.",
    notFoundTitle: "Статья не найдена",
    readArticle: "Читать статью",
    tagsLabel: "Темы",
  },
  ua: {
    articleFallbackDescription: "Стаття Magic Massage Natali про масаж, відновлення та турботу про тіло.",
    authorLabel: "Автор",
    backToBlog: "До всіх статей",
    blogTitle: "Блог",
    dateLocale: "uk-UA",
    emptyDescription: "Ми готуємо перші матеріали. Опубліковані статті з'являться тут.",
    emptyTitle: "Публікацій поки немає",
    eyebrow: "Корисне від Наталі",
    fallbackNotice: "Показано доступну версію іншою мовою.",
    intro: "Практичні матеріали про масаж, відновлення та щоденну турботу про тіло.",
    notFoundDescription: "Ця стаття не опублікована або її адреса більше не актуальна.",
    notFoundTitle: "Статтю не знайдено",
    readArticle: "Читати статтю",
    tagsLabel: "Теми",
  },
  en: {
    articleFallbackDescription: "An article from Magic Massage Natali about massage, recovery and body care.",
    authorLabel: "Author",
    backToBlog: "Back to all articles",
    blogTitle: "Blog",
    dateLocale: "en-GB",
    emptyDescription: "We are preparing the first guides. Published articles will appear here.",
    emptyTitle: "No articles yet",
    eyebrow: "Notes from Natali",
    fallbackNotice: "The available version is shown in another language.",
    intro: "Practical guidance on massage, recovery and everyday body care.",
    notFoundDescription: "This article is not published or its address is no longer current.",
    notFoundTitle: "Article not found",
    readArticle: "Read article",
    tagsLabel: "Topics",
  },
  de: {
    articleFallbackDescription: "Ein Artikel von Magic Massage Natali über Massage, Erholung und Körperpflege.",
    authorLabel: "Autor",
    backToBlog: "Zurück zu allen Artikeln",
    blogTitle: "Blog",
    dateLocale: "de-DE",
    emptyDescription: "Wir bereiten die ersten Beiträge vor. Veröffentlichte Artikel erscheinen hier.",
    emptyTitle: "Noch keine Artikel",
    eyebrow: "Hinweise von Natali",
    fallbackNotice: "Die verfügbare Version wird in einer anderen Sprache angezeigt.",
    intro: "Praktische Hinweise zu Massage, Erholung und täglicher Körperpflege.",
    notFoundDescription: "Dieser Artikel ist nicht veröffentlicht oder seine Adresse ist nicht mehr aktuell.",
    notFoundTitle: "Artikel nicht gefunden",
    readArticle: "Artikel lesen",
    tagsLabel: "Themen",
  },
};

export function getBlogCopy(locale: string): BlogCopy {
  return copyByLocale[locale as BlogCopyLocale] ?? copyByLocale.en;
}
