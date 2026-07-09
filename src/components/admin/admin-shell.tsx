"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  calculateFinanceSummary,
  canAccessAdminSection,
  getAdminModule,
  getAdminNavigationForRole,
  roleLabels,
  type AdminRoleId,
  type AdminSectionId,
  type FinanceRow,
} from "@/admin/config";
import {
  certificateRows,
  clientRows,
  dashboardMetrics,
  financeRows,
  sectionSamples,
  upcomingAppointments,
} from "@/admin/demo-data";

type AdminCalendarAction = "create";
type AdminShellProps = {
  activeSection: AdminSectionId;
  calendarAction?: AdminCalendarAction;
  role: AdminRoleId;
  selectedAppointmentKey?: string;
  selectedBlogPostId?: string;
  selectedCalendarDate?: string;
  selectedClientName?: string;
  selectedCertificateCode?: string;
  selectedContactId?: string;
  selectedMediaId?: string;
  selectedPriceId?: string;
  selectedServiceSlug?: string;
  selectedSettingsGroupId?: string;
  selectedAdminUserId?: string;
};

type AppointmentStatus = "Подтверждена" | "Ожидает" | "Новая заявка" | "Отменена";
type Appointment = {
  id?: string;
  clientId?: string;
  date: string;
  time: string;
  client: string;
  note: string;
  service: string;
  status: AppointmentStatus;
};
type CalendarAppointmentFocus = {
  appointmentKey: string;
  date: string;
  routeDate?: string;
};
type ClientVisit = {
  date: string;
  service: string;
  status: string;
};
type ClientFeedFilterId = "all" | "visits" | "certificates" | "notes";
type ClientNextAction = {
  badgeClassName: string;
  calendarCreateIntent?: boolean;
  ctaLabel: string;
  description: string;
  href: string;
  status: string;
  title: string;
  typeLabel: string;
};
type ClientRecord = {
  id: string;
  email: string;
  history: ClientVisit[];
  language: string;
  name: string;
  next: string;
  note: string;
  phone: string;
  preferredContact: string;
  status: string;
  tags: string[];
  telegram: string;
  totalSpend: string;
  visits: number;
};
type CertificateStatus = "Оплачено" | "Отправлен" | "Ожидает PDF" | "Погашен";
type CertificateRecord = {
  amount: string;
  buyer: string;
  clientId?: string;
  clientName: string;
  code: string;
  expiresAt: string;
  history: string[];
  note: string;
  paymentDate: string;
  recipient: string;
  status: CertificateStatus;
  stripeId: string;
};
type CertificateFormState = {
  amount: string;
  buyer: string;
  clientName: string;
  code: string;
  expiresAt: string;
  note: string;
  paymentDate: string;
  recipient: string;
  status: CertificateStatus;
  stripeId: string;
};
type ServiceStatus = "Опубликована" | "Черновик" | "Скрыта";
type ServiceRecord = {
  category: string;
  coverImage: string;
  duration: string;
  locales: string[];
  name: string;
  order: number;
  seoTitle: string;
  slug: string;
  status: ServiceStatus;
  summary: string;
};
type ServiceFormState = {
  category: string;
  coverImage: string;
  duration: string;
  locales: string;
  name: string;
  order: string;
  seoTitle: string;
  slug: string;
  status: ServiceStatus;
  summary: string;
};
type PriceStatus = "Активна" | "Скрыта";
type PriceRecord = {
  durationMinutes: number;
  id: string;
  note: string;
  order: number;
  priceEur: number;
  serviceSlug: string;
  status: PriceStatus;
  updatedAt: string;
};
type PriceFormState = {
  durationMinutes: string;
  note: string;
  order: string;
  priceEur: string;
  serviceSlug: string;
  status: PriceStatus;
  updatedAt: string;
};
type MediaType = "Фото" | "Документ";
type MediaStatus = "Готово" | "Требует alt" | "Черновик";
type MediaRecord = {
  altText: string;
  dimensions: string;
  folder: string;
  id: string;
  name: string;
  size: string;
  status: MediaStatus;
  type: MediaType;
  uploadedAt: string;
  url: string;
  usage: string[];
};
type MediaFormState = {
  altText: string;
  dimensions: string;
  folder: string;
  name: string;
  size: string;
  status: MediaStatus;
  type: MediaType;
  uploadedAt: string;
  url: string;
  usage: string;
};
type ContactChannelType = "Телефон" | "Email" | "Мессенджер" | "Соцсеть" | "Карта" | "Бронирование";
type ContactStatus = "Активен" | "Черновик" | "Скрыт";
type ContactChannelRecord = {
  id: string;
  name: string;
  note: string;
  status: ContactStatus;
  type: ContactChannelType;
  usage: string[];
  value: string;
};
type ContactChannelFormState = {
  name: string;
  note: string;
  status: ContactStatus;
  type: ContactChannelType;
  usage: string;
  value: string;
};
type ContactSettingsRecord = {
  address: string;
  bookingUrl: string;
  businessName: string;
  email: string;
  mapUrl: string;
  phone: string;
  seoArea: string;
  workingHours: string;
};
type BlogStatus = "Опубликована" | "Черновик" | "Запланирована" | "На проверке";
type BlogPostRecord = {
  author: string;
  body: string;
  category: string;
  coverImage: string;
  excerpt: string;
  id: string;
  locales: string[];
  publishedAt: string;
  seoTitle: string;
  slug: string;
  status: BlogStatus;
  tags: string[];
  title: string;
  updatedAt: string;
};
type BlogPostFormState = {
  author: string;
  body: string;
  category: string;
  coverImage: string;
  excerpt: string;
  locales: string;
  publishedAt: string;
  seoTitle: string;
  slug: string;
  status: BlogStatus;
  tags: string;
  title: string;
};
type SettingsGroupId = "business" | "booking" | "payments" | "email" | "privacySeo" | "rolesAudit";
type CalendarSyncMode = "Отключена" | "Внутренний календарь главный" | "Односторонняя" | "Двусторонняя позже";
type StripeMode = "Тестовый" | "Live после подтверждения";
type SettingsRecord = {
  auditLogRetentionDays: number;
  bookingBufferMinutes: number;
  businessName: string;
  cookiePrivacyMode: string;
  currency: "EUR";
  dailySlotCapacity: number;
  defaultLocale: string;
  defaultSeoTitle: string;
  emailSender: string;
  googleCalendarId: string;
  googleCalendarMode: CalendarSyncMode;
  reminderTemplate: string;
  rolesPolicy: string;
  stripeMode: StripeMode;
  timezone: string;
  updatedAt: string;
  workingDays: string;
  workingHours: string;
};
type SettingsFormState = {
  auditLogRetentionDays: string;
  bookingBufferMinutes: string;
  businessName: string;
  cookiePrivacyMode: string;
  currency: "EUR";
  dailySlotCapacity: string;
  defaultLocale: string;
  defaultSeoTitle: string;
  emailSender: string;
  googleCalendarId: string;
  googleCalendarMode: CalendarSyncMode;
  reminderTemplate: string;
  rolesPolicy: string;
  stripeMode: StripeMode;
  timezone: string;
  workingDays: string;
  workingHours: string;
};
type AdminUserStatus = "Активен" | "Приглашен" | "Пауза" | "Заблокирован";
type AdminUserRecord = {
  accessNote: string;
  email: string;
  history: string[];
  id: string;
  lastLogin: string;
  name: string;
  role: AdminRoleId;
  status: AdminUserStatus;
  twoFactor: boolean;
};
type AdminUserFormState = {
  accessNote: string;
  email: string;
  lastLogin: string;
  name: string;
  role: AdminRoleId;
  status: AdminUserStatus;
  twoFactor: boolean;
};
type CalendarMode = "day" | "week" | "month" | "list";

const groupedNavigation = ["Операции", "Контент", "Финансы", "Система"] as const;
const clientFilterOptions = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "ru", label: "RU" },
  { id: "bg", label: "BG" },
] as const;
type ClientFilterId = (typeof clientFilterOptions)[number]["id"];
const clientFeedFilterOptions = [
  { id: "all", label: "Все" },
  { id: "visits", label: "Визиты" },
  { id: "certificates", label: "Сертификаты" },
  { id: "notes", label: "Заметки" },
] as const satisfies Array<{ id: ClientFeedFilterId; label: string }>;
const clientLanguageOptions = [
  { label: "RU", value: "ru" },
  { label: "BG", value: "bg" },
  { label: "UA", value: "ua" },
  { label: "EN", value: "en" },
] as const;
const clientContactOptions = ["Телефон", "Telegram", "Viber", "Email"] as const;
const clientStatusOptions = ["Новый клиент", "Активный клиент", "Пауза"] as const;
const adminUserStatusOptions: AdminUserStatus[] = ["Активен", "Приглашен", "Пауза", "Заблокирован"];
const adminUserFilterOptions = [
  { id: "all", label: "Все" },
  { id: "active", label: "Активные" },
  { id: "invited", label: "Приглашения" },
  { id: "accountant", label: "Бухгалтеры" },
] as const;
type AdminUserFilterId = (typeof adminUserFilterOptions)[number]["id"];
const adminRoleOptions: Array<{ id: AdminRoleId; label: string }> = [
  { id: "owner", label: roleLabels.owner },
  { id: "administrator", label: roleLabels.administrator },
  { id: "specialist", label: roleLabels.specialist },
  { id: "editor", label: roleLabels.editor },
  { id: "accountant", label: roleLabels.accountant },
  { id: "viewer", label: roleLabels.viewer },
];
const adminRolePermissionSummary: Record<AdminRoleId, { items: string[]; scope: string }> = {
  owner: {
    items: ["Полный доступ ко всем модулям", "Управление ролями", "Критические настройки", "Финансовые отчеты"],
    scope: "Полный контроль админки и системных настроек.",
  },
  administrator: {
    items: ["Клиенты", "Календарь", "Сертификаты", "Контент", "Финансы без системных ролей"],
    scope: "Операционное управление без опасных системных действий.",
  },
  specialist: {
    items: ["Календарь", "Клиенты", "Карточки записей", "Комментарии к сеансам"],
    scope: "Работа с расписанием и клиентскими карточками.",
  },
  editor: {
    items: ["Виды массажа", "Прайс", "Медиа", "Контакты", "Блог"],
    scope: "Контент публичного сайта без доступа к клиентским и финансовым данным.",
  },
  accountant: {
    items: ["Stripe-продажи за период", "Комиссии Stripe", "Возвраты и net-суммы", "Экспорт CSV/XLSX/PDF", "Audit log скачиваний"],
    scope: "Только налоговая выгрузка Stripe без доступа к клиентам, календарю и контенту.",
  },
  viewer: {
    items: ["Просмотр доступных разделов", "Без сохранения изменений", "Без экспорта финансов"],
    scope: "Read-only доступ для проверки контента и операций.",
  },
};
type ClientFormState = {
  email: string;
  language: string;
  name: string;
  next: string;
  note: string;
  phone: string;
  preferredContact: string;
  status: string;
  tags: string;
  telegram: string;
  totalSpend: string;
  visits: string;
};
const appointmentServiceOptions = ["Классический массаж", "Лимфодренажный массаж", "Deep tissue massage", "SPA процедура"] as const;
const appointmentStatusOptions: AppointmentStatus[] = ["Новая заявка", "Ожидает", "Подтверждена", "Отменена"];
const certificateStatusOptions: CertificateStatus[] = ["Оплачено", "Отправлен", "Ожидает PDF", "Погашен"];
const serviceStatusOptions: ServiceStatus[] = ["Опубликована", "Черновик", "Скрыта"];
const priceStatusOptions: PriceStatus[] = ["Активна", "Скрыта"];
const mediaTypeOptions: MediaType[] = ["Фото", "Документ"];
const mediaStatusOptions: MediaStatus[] = ["Готово", "Требует alt", "Черновик"];
const contactChannelTypeOptions: ContactChannelType[] = ["Телефон", "Email", "Мессенджер", "Соцсеть", "Карта", "Бронирование"];
const contactStatusOptions: ContactStatus[] = ["Активен", "Черновик", "Скрыт"];
const blogStatusOptions: BlogStatus[] = ["Опубликована", "Черновик", "Запланирована", "На проверке"];
const calendarSyncModeOptions: CalendarSyncMode[] = ["Отключена", "Внутренний календарь главный", "Односторонняя", "Двусторонняя позже"];
const stripeModeOptions: StripeMode[] = ["Тестовый", "Live после подтверждения"];
const settingsGroups: Array<{ id: SettingsGroupId; status: string; summary: string; title: string }> = [
  {
    id: "business",
    status: "Готово",
    summary: "Название, язык, часовой пояс и базовые данные салона.",
    title: "Бизнес",
  },
  {
    id: "booking",
    status: "Готово",
    summary: "Рабочие часы, слоты, буфер между сеансами и Google Calendar.",
    title: "Запись и календарь",
  },
  {
    id: "payments",
    status: "Ожидает Stripe live",
    summary: "Валюта EUR, Stripe режим и правила сертификатов.",
    title: "Платежи",
  },
  {
    id: "email",
    status: "Черновик",
    summary: "Email отправителя и шаблоны будущих уведомлений.",
    title: "Email",
  },
  {
    id: "privacySeo",
    status: "Готово",
    summary: "Cookie/privacy текст, SEO по умолчанию и локальные метаданные.",
    title: "Privacy и SEO",
  },
  {
    id: "rolesAudit",
    status: "Защищено",
    summary: "Роли, доступ бухгалтера, audit log и опасные действия.",
    title: "Роли и аудит",
  },
];
const calendarModes: Array<{ id: CalendarMode; label: string }> = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "list", label: "Список" },
];
const calendarMonthLabel = "Июль 2026";
const calendarWeekdayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const calendarWeekLabel = "Неделя 6-12 июля";
const calendarMonthDays = Array.from({ length: 31 }, (_, index) => {
  const day = index + 1;

  return {
    date: `2026-07-${String(day).padStart(2, "0")}`,
    day,
  };
});
const calendarLeadingBlankDays = 2;
const initialServiceRows: ServiceRecord[] = [
  {
    category: "Массаж",
    coverImage: "/media/services/classic-massage.jpg",
    duration: "60-90 мин",
    locales: ["bg", "ru", "ua", "en"],
    name: "Классический массаж",
    order: 1,
    seoTitle: "Классический массаж в Бургасе",
    slug: "classic-massage",
    status: "Опубликована",
    summary: "Базовая услуга для расслабления, восстановления тонуса и снятия усталости.",
  },
  {
    category: "Массаж",
    coverImage: "/media/services/lymphatic-drainage-massage.jpg",
    duration: "60-90 мин",
    locales: ["bg", "ru", "ua", "en"],
    name: "Лимфодренажный массаж",
    order: 2,
    seoTitle: "Лимфодренажный массаж в Бургасе",
    slug: "lymphatic-drainage-massage",
    status: "Опубликована",
    summary: "Мягкие ритмичные техники для ощущения легкости и бережной работы с тканями.",
  },
  {
    category: "Массаж",
    coverImage: "/media/services/deep-tissue-massage.jpg",
    duration: "60-90 мин",
    locales: ["bg", "ru", "ua", "en"],
    name: "Deep tissue massage",
    order: 3,
    seoTitle: "Deep tissue massage Burgas",
    slug: "deep-tissue-massage",
    status: "Черновик",
    summary: "Более глубокая и медленная работа с зонами устойчивого напряжения.",
  },
];
const initialPriceRows: PriceRecord[] = [
  {
    durationMinutes: 60,
    id: "price-classic-60",
    note: "Основной вариант для публичного прайса.",
    order: 1,
    priceEur: 70,
    serviceSlug: "classic-massage",
    status: "Активна",
    updatedAt: "2026-07-07",
  },
  {
    durationMinutes: 90,
    id: "price-lymphatic-90",
    note: "Курс можно уточнять в карточке услуги.",
    order: 2,
    priceEur: 95,
    serviceSlug: "lymphatic-drainage-massage",
    status: "Активна",
    updatedAt: "2026-07-07",
  },
  {
    durationMinutes: 60,
    id: "price-deep-60",
    note: "Пока скрыто до финального подтверждения текста.",
    order: 3,
    priceEur: 85,
    serviceSlug: "deep-tissue-massage",
    status: "Скрыта",
    updatedAt: "2026-07-07",
  },
];
const initialMediaRows: MediaRecord[] = [
  {
    altText: "Классический массаж в кабинете Magic Massage Natali",
    dimensions: "1600x1100",
    folder: "services",
    id: "media-classic-cover",
    name: "Классический массаж",
    size: "368 KB",
    status: "Готово",
    type: "Фото",
    uploadedAt: "2026-07-07",
    url: "/media/services/classic-massage.jpg",
    usage: ["Услуга: Классический массаж", "Каталог услуг"],
  },
  {
    altText: "",
    dimensions: "1800x1200",
    folder: "gallery",
    id: "media-studio-room",
    name: "Фото кабинета",
    size: "512 KB",
    status: "Требует alt",
    type: "Фото",
    uploadedAt: "2026-07-07",
    url: "/media/gallery/studio-treatment-room.jpg",
    usage: ["Галерея", "Главная"],
  },
  {
    altText: "Сертификат массажиста Natali",
    dimensions: "1200x1600",
    folder: "certificates",
    id: "media-certificate-natali",
    name: "Сертификат Natali",
    size: "246 KB",
    status: "Готово",
    type: "Документ",
    uploadedAt: "2026-07-07",
    url: "/media/about/certificates/04-massage-therapist.webp",
    usage: ["О специалисте"],
  },
];
const initialContactSettings: ContactSettingsRecord = {
  address: "ул. Места 49, Бургас, Болгария",
  bookingUrl: "https://studio24.bg/magic-massage-natali",
  businessName: "Magic Massage Natali",
  email: "info@magicmassage.bg",
  mapUrl: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
  phone: "+359 87 333 4411",
  seoArea: "Burgas, Bulgaria",
  workingHours: "Пн-Сб 10:00-19:00",
};
const initialContactChannels: ContactChannelRecord[] = [
  {
    id: "contact-phone",
    name: "Телефон салона",
    note: "Основной номер для шапки, контактов, LocalBusiness schema и быстрых CTA.",
    status: "Активен",
    type: "Телефон",
    usage: ["Шапка сайта", "Контакты", "LocalBusiness SEO"],
    value: "+359 87 333 4411",
  },
  {
    id: "contact-email",
    name: "Email",
    note: "Публичный email для сертификатов, вопросов и административной связи.",
    status: "Активен",
    type: "Email",
    usage: ["Контакты", "Письма по сертификатам"],
    value: "info@magicmassage.bg",
  },
  {
    id: "contact-telegram",
    name: "Telegram",
    note: "Можно показывать после подтверждения финальной ссылки клиента.",
    status: "Черновик",
    type: "Мессенджер",
    usage: ["Контакты", "Быстрая связь"],
    value: "https://t.me/magicmassage_demo",
  },
  {
    id: "contact-map",
    name: "Google Maps",
    note: "Карта должна грузиться только после cookie consent на публичном сайте.",
    status: "Активен",
    type: "Карта",
    usage: ["Контакты", "LocalBusiness SEO"],
    value: "https://maps.google.com/?q=Magic+Massage+Natali+Burgas",
  },
  {
    id: "contact-instagram",
    name: "Instagram",
    note: "Оставить скрытым до подтверждения официального профиля.",
    status: "Скрыт",
    type: "Соцсеть",
    usage: ["Футер", "Контакты"],
    value: "https://instagram.com/magicmassage_demo",
  },
  {
    id: "contact-studio24",
    name: "Studio24 booking",
    note: "Публичные CTA записи ведут сюда, пока внутреннее бронирование не запущено.",
    status: "Активен",
    type: "Бронирование",
    usage: ["Hero CTA", "Услуги", "Контакты"],
    value: "https://studio24.bg/magic-massage-natali",
  },
];
const initialBlogPostRows: BlogPostRecord[] = [
  {
    author: "Natali",
    body: "Короткая памятка помогает клиенту подготовиться к первому визиту, прийти вовремя и заранее выбрать комфортную одежду.",
    category: "Советы",
    coverImage: "/media/blog/first-massage-preparation.jpg",
    excerpt: "Что стоит знать перед первым сеансом массажа в Magic Massage Natali.",
    id: "blog-first-massage-preparation",
    locales: ["ru", "bg", "ua", "en"],
    publishedAt: "2026-07-05",
    seoTitle: "Подготовка к первому массажу в Бургасе",
    slug: "first-massage-preparation",
    status: "Опубликована",
    tags: ["подготовка", "первый визит"],
    title: "Подготовка к первому массажу",
    updatedAt: "2026-07-07",
  },
  {
    author: "Natali",
    body: "Черновик статьи объясняет, когда лимфодренажный массаж может быть уместен, какие ожидания стоит проговорить и как избежать медицинских обещаний.",
    category: "Услуги",
    coverImage: "/media/services/lymphatic-drainage-massage.jpg",
    excerpt: "Спокойное объяснение услуги без неподтвержденных медицинских обещаний.",
    id: "blog-lymphatic-draft",
    locales: ["ru", "bg"],
    publishedAt: "2026-07-12",
    seoTitle: "Лимфодренажный массаж в Бургасе",
    slug: "lymphatic-when-useful",
    status: "Черновик",
    tags: ["лимфодренаж", "услуги"],
    title: "Лимфодренаж: когда он уместен",
    updatedAt: "2026-07-07",
  },
  {
    author: "Natali",
    body: "Запланированная статья рассказывает, как выбрать сумму сертификата, кому он подойдет и как получатель сможет записаться на услугу.",
    category: "Сертификаты",
    coverImage: "/media/gift-certificates/certificate-preview.jpg",
    excerpt: "Как выбрать подарочный сертификат и не усложнять покупку.",
    id: "blog-gift-certificate",
    locales: ["ru", "en"],
    publishedAt: "2026-07-18",
    seoTitle: "Подарочный сертификат на массаж в Бургасе",
    slug: "gift-certificate-without-stress",
    status: "Запланирована",
    tags: ["сертификат", "подарок"],
    title: "Подарочный сертификат без стресса",
    updatedAt: "2026-07-07",
  },
];
const initialSettingsRecord: SettingsRecord = {
  auditLogRetentionDays: 180,
  bookingBufferMinutes: 30,
  businessName: "Magic Massage Natali",
  cookiePrivacyMode: "Google Maps только после consent; Stripe только в оплате сертификата.",
  currency: "EUR",
  dailySlotCapacity: 4,
  defaultLocale: "bg",
  defaultSeoTitle: "Magic Massage Natali - массаж в Бургасе",
  emailSender: "info@magicmassage.bg",
  googleCalendarId: "",
  googleCalendarMode: "Внутренний календарь главный",
  reminderTemplate: "Напоминание за 24 часа до записи после запуска email-провайдера.",
  rolesPolicy: "Владелец управляет настройками; администратор работает без критических системных действий.",
  stripeMode: "Тестовый",
  timezone: "Europe/Sofia",
  updatedAt: "2026-07-07",
  workingDays: "Пн-Сб",
  workingHours: "10:00-19:00",
};
const initialAdminUserRows: AdminUserRecord[] = [
  {
    accessNote: "Публикует материалы сайта и готовит переводы, без доступа к Stripe и клиентским данным.",
    email: "content@magicmassage.bg",
    history: ["2026-07-07: приглашение создано владельцем.", "2026-07-07: назначена роль редактора."],
    id: "admin-user-content",
    lastLogin: "Еще не входила",
    name: "Мария Контент",
    role: "editor",
    status: "Приглашен",
    twoFactor: false,
  },
  {
    accessNote: "Владелец салона, подтверждает роли, настройки, финансы и опасные действия.",
    email: "natali@magicmassage.bg",
    history: ["2026-07-07: владелец подтвержден.", "2026-07-07: 2FA включена."],
    id: "admin-user-owner",
    lastLogin: "2026-07-07 10:12",
    name: "Natali Ivanova",
    role: "owner",
    status: "Активен",
    twoFactor: true,
  },
  {
    accessNote: "Операционный доступ к календарю, клиентам, сертификатам и контенту без управления ролями.",
    email: "admin@magicmassage.bg",
    history: ["2026-07-06: вход в админку.", "2026-07-05: обновлены сертификаты."],
    id: "admin-user-operations",
    lastLogin: "2026-07-06 18:40",
    name: "Анна Операции",
    role: "administrator",
    status: "Активен",
    twoFactor: true,
  },
  {
    accessNote: "Работает только с расписанием, комментариями к записям и клиентскими карточками.",
    email: "specialist@magicmassage.bg",
    history: ["2026-07-07: просмотр календаря.", "2026-07-06: обновлен комментарий к записи."],
    id: "admin-user-specialist",
    lastLogin: "2026-07-07 09:30",
    name: "Ольга Специалист",
    role: "specialist",
    status: "Активен",
    twoFactor: false,
  },
  {
    accessNote: "Stripe-отчеты для налогов: продажи за период, комиссии, возвраты, net-суммы и audit log скачиваний.",
    email: "finance@magicmassage.bg",
    history: ["2026-07-07: скачан CSV отчет за июль.", "2026-07-06: роль Бухгалтер подтверждена владельцем."],
    id: "admin-user-accountant",
    lastLogin: "2026-07-07 11:05",
    name: "Ирина Finance",
    role: "accountant",
    status: "Активен",
    twoFactor: true,
  },
  {
    accessNote: "Read-only доступ для проверки материалов перед публикацией.",
    email: "reviewer@magicmassage.bg",
    history: ["2026-07-05: просмотр публичного контента."],
    id: "admin-user-viewer",
    lastLogin: "2026-07-05 15:20",
    name: "Reviewer Demo",
    role: "viewer",
    status: "Пауза",
    twoFactor: false,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    currency: "EUR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function addMonthsToIsoDate(date: string, months: number) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);

  return nextDate.toISOString().slice(0, 10);
}

function statusClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes("ожидает") || normalizedStatus.includes("новая")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("черновик")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("требует")) {
    return "admin-status admin-status-warning";
  }

  if (normalizedStatus.includes("отмен") || normalizedStatus.includes("возврат")) {
    return "admin-status admin-status-danger";
  }

  if (normalizedStatus.includes("скрыт")) {
    return "admin-status admin-status-danger";
  }

  return "admin-status admin-status-success";
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function normalizeClientPhone(value: string) {
  return value.replace(/\D/g, "");
}

function matchesSearch(values: Array<string | number | undefined>, query: string) {
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => String(value ?? "").toLocaleLowerCase("ru-RU").includes(normalizedQuery));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildClientIdFromPhone(phone: string) {
  const phoneKey = normalizeClientPhone(phone);

  return phoneKey ? `client-${phoneKey}` : `client-${normalizeSearch(phone) || "manual"}`;
}

function findInitialClientIdByName(clientName: string) {
  const normalizedClientName = normalizeSearch(clientName);
  const client = clientRows.find((row) => normalizeSearch(row.name) === normalizedClientName);

  return client ? buildClientIdFromPhone(client.phone) : undefined;
}

function buildInitialClientRows(): ClientRecord[] {
  return clientRows.map((client) => ({
    ...client,
    id: buildClientIdFromPhone(client.phone),
    history: client.history.map((visit) => ({ ...visit })),
    tags: [...client.tags],
  }));
}

function buildInitialCertificateRows(): CertificateRecord[] {
  return certificateRows.map((certificate, index) => {
    const financeRow = financeRows.find((row) => row.certificateCode === certificate.code);
    const paymentDate = financeRow?.date ?? "2026-07-01";

    return {
      ...certificate,
      clientId: findInitialClientIdByName(certificate.clientName),
      expiresAt: addMonthsToIsoDate(paymentDate, 6),
      history: [
        `${paymentDate}: Stripe оплата связана с ${financeRow?.id ?? "manual"}.`,
        certificate.status === "Ожидает PDF" ? "PDF ожидает генерации." : "PDF готов к отправке.",
      ],
      note: index === 2 ? "Проверить PDF перед повторной отправкой клиенту." : "Автоматически создан из оплаты Stripe.",
      paymentDate,
      status: certificate.status as CertificateStatus,
      stripeId: financeRow?.id ?? "manual",
    };
  });
}

function buildInitialServiceRows(): ServiceRecord[] {
  return initialServiceRows.map((service) => ({
    ...service,
    locales: [...service.locales],
  }));
}

function buildInitialPriceRows(): PriceRecord[] {
  return initialPriceRows.map((price) => ({ ...price }));
}

function buildInitialMediaRows(): MediaRecord[] {
  return initialMediaRows.map((item) => ({
    ...item,
    usage: [...item.usage],
  }));
}

function buildInitialContactChannels(): ContactChannelRecord[] {
  return initialContactChannels.map((channel) => ({
    ...channel,
    usage: [...channel.usage],
  }));
}

function buildInitialContactSettings(): ContactSettingsRecord {
  return { ...initialContactSettings };
}

function buildInitialBlogPostRows(): BlogPostRecord[] {
  return initialBlogPostRows.map((post) => ({
    ...post,
    locales: [...post.locales],
    tags: [...post.tags],
  }));
}

function buildInitialSettingsRecord(): SettingsRecord {
  return { ...initialSettingsRecord };
}

function buildInitialAdminUsers(): AdminUserRecord[] {
  return initialAdminUserRows.map((user) => ({
    ...user,
    history: [...user.history],
  }));
}

function buildClientFormState(client?: ClientRecord): ClientFormState {
  return {
    email: client?.email ?? "",
    language: client?.language ?? "ru",
    name: client?.name ?? "",
    next: client?.next ?? "",
    note: client?.note ?? "",
    phone: client?.phone ?? "",
    preferredContact: client?.preferredContact ?? "Телефон",
    status: client?.status ?? "Новый клиент",
    tags: client?.tags.join(", ") ?? "",
    telegram: client?.telegram ?? "",
    totalSpend: client?.totalSpend ?? "0 €",
    visits: String(client?.visits ?? 0),
  };
}

function buildAdminUserFormState(user?: AdminUserRecord): AdminUserFormState {
  return {
    accessNote: user?.accessNote ?? "",
    email: user?.email ?? "",
    lastLogin: user?.lastLogin ?? "Еще не входил",
    name: user?.name ?? "",
    role: user?.role ?? "viewer",
    status: user?.status ?? "Приглашен",
    twoFactor: user?.twoFactor ?? false,
  };
}

function buildCertificateFormState(certificate?: CertificateRecord): CertificateFormState {
  return {
    amount: certificate?.amount ?? "0 €",
    buyer: certificate?.buyer ?? "",
    clientName: certificate?.clientName ?? "",
    code: certificate?.code ?? "",
    expiresAt: certificate?.expiresAt ?? "2027-01-07",
    note: certificate?.note ?? "",
    paymentDate: certificate?.paymentDate ?? "2026-07-07",
    recipient: certificate?.recipient ?? "",
    status: certificate?.status ?? "Оплачено",
    stripeId: certificate?.stripeId ?? "manual",
  };
}

function buildClientCertificateDraft(client: ClientRecord, certificates: CertificateRecord[]): CertificateRecord {
  const nextSuffix =
    Math.max(
      1020,
      ...certificates.map((certificate) => {
        const suffixMatch = certificate.code.match(/(\d+)$/);

        return suffixMatch ? Number(suffixMatch[1]) : 0;
      }),
    ) + 1;

  return {
    amount: "0 €",
    buyer: client.name,
    clientId: client.id,
    clientName: client.name,
    code: `MMN-2407-${nextSuffix}`,
    expiresAt: "2027-01-07",
    history: [],
    note: `Выдано из карточки клиента ${client.name}`,
    paymentDate: "2026-07-07",
    recipient: client.name,
    status: "Оплачено",
    stripeId: "manual",
  };
}

function buildServiceFormState(service?: ServiceRecord): ServiceFormState {
  return {
    category: service?.category ?? "Массаж",
    coverImage: service?.coverImage ?? "",
    duration: service?.duration ?? "60 мин",
    locales: service?.locales.join(", ") ?? "bg, ru, ua, en",
    name: service?.name ?? "",
    order: String(service?.order ?? initialServiceRows.length + 1),
    seoTitle: service?.seoTitle ?? "",
    slug: service?.slug ?? "",
    status: service?.status ?? "Черновик",
    summary: service?.summary ?? "",
  };
}

function buildPriceFormState(services: ServiceRecord[], price?: PriceRecord): PriceFormState {
  return {
    durationMinutes: price ? String(price.durationMinutes) : "",
    note: price?.note ?? "",
    order: String(price?.order ?? initialPriceRows.length + 1),
    priceEur: price ? String(price.priceEur) : "",
    serviceSlug: price?.serviceSlug ?? services[0]?.slug ?? "",
    status: price?.status ?? "Активна",
    updatedAt: price?.updatedAt ?? "2026-07-07",
  };
}

function buildMediaFormState(media?: MediaRecord): MediaFormState {
  return {
    altText: media?.altText ?? "",
    dimensions: media?.dimensions ?? "",
    folder: media?.folder ?? "services",
    name: media?.name ?? "",
    size: media?.size ?? "",
    status: media?.status ?? "Черновик",
    type: media?.type ?? "Фото",
    uploadedAt: media?.uploadedAt ?? "2026-07-07",
    url: media?.url ?? "",
    usage: media?.usage.join(", ") ?? "",
  };
}

function buildContactChannelFormState(channel?: ContactChannelRecord): ContactChannelFormState {
  return {
    name: channel?.name ?? "",
    note: channel?.note ?? "",
    status: channel?.status ?? "Черновик",
    type: channel?.type ?? "Телефон",
    usage: channel?.usage.join(", ") ?? "",
    value: channel?.value ?? "",
  };
}

function buildContactSettingsFormState(settings: ContactSettingsRecord): ContactSettingsRecord {
  return { ...settings };
}

function buildBlogPostFormState(post?: BlogPostRecord): BlogPostFormState {
  return {
    author: post?.author ?? "Natali",
    body: post?.body ?? "",
    category: post?.category ?? "",
    coverImage: post?.coverImage ?? "",
    excerpt: post?.excerpt ?? "",
    locales: post?.locales.join(", ") ?? "ru, bg, ua, en",
    publishedAt: post?.publishedAt ?? "2026-07-07",
    seoTitle: post?.seoTitle ?? "",
    slug: post?.slug ?? "",
    status: post?.status ?? "Черновик",
    tags: post?.tags.join(", ") ?? "",
    title: post?.title ?? "",
  };
}

function buildSettingsFormState(settings: SettingsRecord): SettingsFormState {
  return {
    auditLogRetentionDays: String(settings.auditLogRetentionDays),
    bookingBufferMinutes: String(settings.bookingBufferMinutes),
    businessName: settings.businessName,
    cookiePrivacyMode: settings.cookiePrivacyMode,
    currency: settings.currency,
    dailySlotCapacity: String(settings.dailySlotCapacity),
    defaultLocale: settings.defaultLocale,
    defaultSeoTitle: settings.defaultSeoTitle,
    emailSender: settings.emailSender,
    googleCalendarId: settings.googleCalendarId,
    googleCalendarMode: settings.googleCalendarMode,
    reminderTemplate: settings.reminderTemplate,
    rolesPolicy: settings.rolesPolicy,
    stripeMode: settings.stripeMode,
    timezone: settings.timezone,
    workingDays: settings.workingDays,
    workingHours: settings.workingHours,
  };
}

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function getDialogFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getDialogFocusableElements(event.currentTarget);

  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey && (activeElement === firstElement || activeElement === event.currentTarget)) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function parseClientTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createMediaId(name: string, url: string) {
  const base = normalizeSearch(name || url)
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return `media-${base || "asset"}`;
}

function createContactChannelId(name: string, value: string) {
  const base = normalizeSearch(name || value)
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return `contact-${base || "channel"}`;
}

function createBlogPostId(title: string, slug: string) {
  const base = normalizeSearch(slug || title)
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return `blog-${base || "post"}`;
}

function createAdminUserId(name: string, email: string) {
  const base = normalizeSearch(email || name)
    .replace(/@/g, "-")
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return `admin-user-${base || "invite"}`;
}

function matchesClientIdentity(client: ClientRecord, identity: string | undefined) {
  const normalizedIdentity = identity ? normalizeSearch(identity) : "";
  const normalizedPhoneIdentity = identity ? normalizeClientPhone(identity) : "";

  return (
    (Boolean(normalizedIdentity) && normalizeSearch(client.id) === normalizedIdentity) ||
    (Boolean(normalizedIdentity) && normalizeSearch(client.name) === normalizedIdentity) ||
    (Boolean(normalizedPhoneIdentity) && normalizeClientPhone(client.phone) === normalizedPhoneIdentity)
  );
}

function findClientByIdentity(clients: ClientRecord[], identity: string | undefined) {
  return clients.find((client) => matchesClientIdentity(client, identity));
}

function findUniqueClientByName(clients: ClientRecord[], name: string | undefined) {
  const normalizedName = name ? normalizeSearch(name) : "";

  if (!normalizedName) {
    return undefined;
  }

  const matches = clients.filter((client) => normalizeSearch(client.name) === normalizedName);

  return matches.length === 1 ? matches[0] : undefined;
}

function findAppointmentClient(clients: ClientRecord[], appointment: Appointment) {
  return findClientByIdentity(clients, appointment.clientId) ?? findUniqueClientByName(clients, appointment.client);
}

function findCertificateClient(clients: ClientRecord[], certificate: CertificateRecord) {
  return findClientByIdentity(clients, certificate.clientId) ?? findUniqueClientByName(clients, certificate.clientName);
}

function findClientPhoneDuplicate(clients: ClientRecord[], phone: string, originalClientIdentity?: string) {
  const candidatePhone = normalizeClientPhone(phone);

  if (!candidatePhone) {
    return undefined;
  }

  return clients.find((client) => {
    if (matchesClientIdentity(client, originalClientIdentity)) {
      return false;
    }

    return normalizeClientPhone(client.phone) === candidatePhone;
  });
}

function findClientNameMatch(clients: ClientRecord[], name: string, originalClientIdentity?: string) {
  const candidateName = normalizeSearch(name);

  if (!candidateName) {
    return undefined;
  }

  return clients.find((client) => {
    if (matchesClientIdentity(client, originalClientIdentity)) {
      return false;
    }

    return normalizeSearch(client.name) === candidateName;
  });
}

function isClientNameAmbiguous(clients: ClientRecord[], clientName: string) {
  const normalizedClientName = normalizeSearch(clientName);

  return clients.filter((client) => normalizeSearch(client.name) === normalizedClientName).length > 1;
}

function appointmentBelongsToClient(appointment: Appointment, client: ClientRecord, clients: ClientRecord[]) {
  if (appointment.clientId) {
    return appointment.clientId === client.id;
  }

  return !isClientNameAmbiguous(clients, client.name) && matchesClientName(appointment.client, client.name);
}

function certificateBelongsToClient(certificate: CertificateRecord, client: ClientRecord, clients: ClientRecord[]) {
  if (certificate.clientId) {
    return certificate.clientId === client.id;
  }

  return !isClientNameAmbiguous(clients, client.name) && matchesClientName(certificate.clientName, client.name);
}

function findClientAppointments(appointments: Appointment[], client: ClientRecord, clients: ClientRecord[]) {
  return appointments.filter((appointment) => appointmentBelongsToClient(appointment, client, clients));
}

function findClientCertificates(certificates: CertificateRecord[], client: ClientRecord, clients: ClientRecord[]): CertificateRecord[] {
  return certificates.filter((certificate) => certificateBelongsToClient(certificate, client, clients));
}

function matchesClientName(value: string, clientName: string | undefined) {
  return !clientName || normalizeSearch(value) === normalizeSearch(clientName);
}

function findServiceBySlug(services: ServiceRecord[], slug: string) {
  return services.find((service) => normalizeSearch(service.slug) === normalizeSearch(slug));
}

function priceLabel(price: PriceRecord, services: ServiceRecord[]) {
  const service = findServiceBySlug(services, price.serviceSlug);

  return `${service?.name ?? price.serviceSlug} · ${price.durationMinutes} мин`;
}

function priceValue(price: PriceRecord) {
  return `${price.priceEur} €`;
}

function matchesClientFilter(client: ClientRecord, filter: ClientFilterId) {
  if (filter === "active") {
    return isActiveClient(client);
  }

  if (filter === "ru" || filter === "bg") {
    return normalizeSearch(client.language) === filter;
  }

  return true;
}

function matchesAdminUserFilter(user: AdminUserRecord, filter: AdminUserFilterId) {
  if (filter === "active") {
    return user.status === "Активен";
  }

  if (filter === "invited") {
    return user.status === "Приглашен";
  }

  if (filter === "accountant") {
    return user.role === "accountant";
  }

  return true;
}

function isActiveClient(client: ClientRecord) {
  return clientActivitySummary(client).isActive;
}

function clientActivitySummary(client: ClientRecord) {
  const hasActiveStatus = normalizeSearch(client.status).startsWith("актив");
  const hasEnoughVisits = client.visits >= 5;
  const isActive = hasActiveStatus && hasEnoughVisits;
  const visitLabel = visitCountLabel(client.visits);

  return {
    details: `${hasActiveStatus ? "статус активный" : `статус: ${client.status}`}, ${
      hasEnoughVisits ? "5+ визитов" : "меньше 5 визитов"
    }`,
    isActive,
    nextVisit: `Следующий визит: ${client.next}`,
    reason: `${isActive ? "В активных" : "Не в активных"}: ${visitLabel}`,
  };
}

function visitCountLabel(visits: number) {
  const absoluteVisits = Math.abs(visits);
  const lastTwoDigits = absoluteVisits % 100;
  const lastDigit = absoluteVisits % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${visits} визитов`;
  }

  if (lastDigit === 1) {
    return `${visits} визит`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${visits} визита`;
  }

  return `${visits} визитов`;
}

function clientProfileHref(clientIdentity: string, role: AdminRoleId) {
  return `/admin?section=clients&role=${role}&client=${encodeURIComponent(clientIdentity)}`;
}

function adminSectionHref(section: AdminSectionId, role: AdminRoleId) {
  return `/admin?section=${section}&role=${role}`;
}

function calendarClientHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=calendar&role=${role}&client=${encodeURIComponent(clientName)}`;
}

function calendarDateHref(date: string, role: AdminRoleId, clientName?: string) {
  const clientQuery = clientName ? `&client=${encodeURIComponent(clientName)}` : "";

  return `/admin?section=calendar&role=${role}&date=${encodeURIComponent(date)}${clientQuery}`;
}

function calendarAppointmentHref(appointment: Appointment, role: AdminRoleId, clientName?: string) {
  return `${calendarDateHref(appointment.date, role, clientName)}&appointment=${encodeURIComponent(appointmentKey(appointment))}`;
}

function certificateClientHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=certificates&role=${role}&client=${encodeURIComponent(clientName)}`;
}

function certificateDetailHref(certificateCode: string, role: AdminRoleId) {
  return `/admin?section=certificates&role=${role}&certificate=${encodeURIComponent(certificateCode)}`;
}

function serviceDetailHref(serviceSlug: string, role: AdminRoleId) {
  return `/admin?section=services&role=${role}&service=${encodeURIComponent(serviceSlug)}`;
}

function priceDetailHref(priceId: string, role: AdminRoleId) {
  return `/admin?section=price&role=${role}&price=${encodeURIComponent(priceId)}`;
}

function mediaDetailHref(mediaId: string, role: AdminRoleId) {
  return `/admin?section=media&role=${role}&media=${encodeURIComponent(mediaId)}`;
}

function contactDetailHref(contactId: string, role: AdminRoleId) {
  return `/admin?section=contacts&role=${role}&contact=${encodeURIComponent(contactId)}`;
}

function blogDetailHref(blogPostId: string, role: AdminRoleId) {
  return `/admin?section=blog&role=${role}&blog=${encodeURIComponent(blogPostId)}`;
}

function settingsDetailHref(settingsGroupId: SettingsGroupId, role: AdminRoleId) {
  return `/admin?section=settings&role=${role}&settings=${encodeURIComponent(settingsGroupId)}`;
}

function userDetailHref(userId: string, role: AdminRoleId) {
  return `/admin?section=users&role=${role}&user=${encodeURIComponent(userId)}`;
}

function calendarCreateHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=calendar&role=${role}&client=${encodeURIComponent(clientName)}&action=create`;
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function appointmentKey(appointment: Appointment) {
  return appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.client}`;
}

function appointmentVisitLabel(appointment: Appointment) {
  return `${formatCalendarDay(appointment.date)}, ${appointment.time}`;
}

function findClientVisitAppointment(visit: ClientVisit, appointments: Appointment[]) {
  const normalizedVisitDate = normalizeSearch(visit.date);
  const normalizedVisitService = normalizeSearch(visit.service);

  return appointments.find(
    (appointment) =>
      normalizeSearch(appointment.service) === normalizedVisitService &&
      normalizeSearch(appointmentVisitLabel(appointment)) === normalizedVisitDate,
  );
}

function findClientNextAppointment(appointments: Appointment[]) {
  return sortAppointments(appointments).find((appointment) => appointment.status !== "Отменена");
}

function findClientLastCompletedVisit(client: ClientRecord) {
  return client.history.find((visit) => normalizeSearch(visit.status).includes("заверш")) ?? client.history[client.history.length - 1];
}

function findClientActiveCertificate(certificates: CertificateRecord[]) {
  return certificates.find((certificate) => certificate.status !== "Погашен") ?? certificates[0];
}

function buildClientNextAction(
  client: ClientRecord,
  nextAppointment: Appointment | undefined,
  activeCertificate: CertificateRecord | undefined,
  role: AdminRoleId,
): ClientNextAction {
  if (activeCertificate?.status === "Ожидает PDF") {
    return {
      badgeClassName: statusClass(activeCertificate.status),
      ctaLabel: "Открыть сертификат",
      description: `${activeCertificate.code} · ${activeCertificate.amount}`,
      href: certificateDetailHref(activeCertificate.code, role),
      status: activeCertificate.status,
      title: "Подготовить PDF сертификата",
      typeLabel: "Сертификат",
    };
  }

  if (nextAppointment && nextAppointment.status !== "Подтверждена") {
    return {
      badgeClassName: statusClass(nextAppointment.status),
      ctaLabel: "Открыть запись",
      description: `${appointmentVisitLabel(nextAppointment)} · ${nextAppointment.service}`,
      href: calendarAppointmentHref(nextAppointment, role, client.id),
      status: nextAppointment.status,
      title: "Подтвердить запись клиента",
      typeLabel: "Запись",
    };
  }

  if (!nextAppointment) {
    return {
      badgeClassName: "admin-status admin-status-warning",
      calendarCreateIntent: true,
      ctaLabel: "Создать запись",
      description: "В календаре нет будущей записи для этого клиента.",
      href: calendarCreateHref(client.id, role),
      status: "Нет записи",
      title: "Записать клиента",
      typeLabel: "Календарь",
    };
  }

  return {
    badgeClassName: statusClass(nextAppointment.status),
    ctaLabel: "Открыть запись",
    description: `${appointmentVisitLabel(nextAppointment)} · ${nextAppointment.service}`,
    href: calendarAppointmentHref(nextAppointment, role, client.id),
    status: nextAppointment.status,
    title: "Проверить ближайшую запись",
    typeLabel: "Запись",
  };
}

function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((first, second) =>
    `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`),
  );
}

function buildInitialCalendarAppointments() {
  return upcomingAppointments.map((appointment, index) => ({
    ...appointment,
    clientId: findInitialClientIdByName(appointment.client),
    id: `demo-${index + 1}`,
  }));
}

function calendarHeadingLabel(mode: CalendarMode, selectedDate: string) {
  if (mode === "month") {
    return calendarMonthLabel;
  }

  if (mode === "week") {
    return calendarWeekLabel;
  }

  if (mode === "list") {
    return "Список записей";
  }

  return formatCalendarDay(selectedDate);
}

function formatCalendarDay(date: string) {
  return `${Number(date.slice(-2))} июля`;
}

function formatCalendarShortDay(date: string) {
  return `${Number(date.slice(-2))} июл`;
}

function isCalendarMonthDate(date: string | undefined): date is string {
  return Boolean(date && calendarMonthDays.some((day) => day.date === date));
}

function appointmentCountLabel(count: number) {
  if (count === 1) {
    return "1 запись";
  }

  if (count > 1 && count < 5) {
    return `${count} записи`;
  }

  return `${count} записей`;
}

function compactAppointmentCountLabel(count: number) {
  return `${count} зап.`;
}

function freeSlotCount(appointmentCount: number, dailySlotCapacity: number) {
  return Math.max(0, dailySlotCapacity - appointmentCount);
}

function freeSlotLabel(count: number) {
  if (count === 1) {
    return "1 свободный слот";
  }

  if (count > 1 && count < 5) {
    return `${count} свободных слота`;
  }

  return `${count} свободных слотов`;
}

function compactFreeSlotLabel(count: number) {
  return `${count} св.`;
}

function slotCountLabel(count: number) {
  if (count === 1) {
    return "1 слот";
  }

  if (count > 1 && count < 5) {
    return `${count} слота`;
  }

  return `${count} слотов`;
}

function paymentCountLabel(count: number) {
  if (count === 1) {
    return "1 платеж";
  }

  if (count > 1 && count < 5) {
    return `${count} платежа`;
  }

  return `${count} платежей`;
}

function matchesDatePeriod(date: string | undefined, startDate: string, endDate: string) {
  if (!date) {
    return false;
  }

  const startsAfterOrAtStart = startDate ? date >= startDate : true;
  const endsBeforeOrAtEnd = endDate ? date <= endDate : true;

  return startsAfterOrAtStart && endsBeforeOrAtEnd;
}

function formatFinancePeriod(startDate: string, endDate: string) {
  if (startDate && endDate) {
    return `${startDate} - ${endDate}`;
  }

  if (startDate) {
    return `с ${startDate}`;
  }

  if (endDate) {
    return `по ${endDate}`;
  }

  return "весь период";
}

function csvCell(value: string | number | undefined) {
  const stringValue = String(value ?? "");

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function buildFinanceCsv(rows: FinanceRow[]) {
  const header = ["date", "payment_id", "certificate", "buyer", "gross_eur", "stripe_fee_eur", "refund_eur", "net_eur", "status"];
  const body = rows.map((row) => [
    row.date,
    row.id,
    row.certificateCode,
    row.buyer,
    row.gross.toFixed(2),
    row.stripeFee.toFixed(2),
    row.refund.toFixed(2),
    (row.gross - row.refund - row.stripeFee).toFixed(2),
    row.status,
  ]);

  return [header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined" || typeof Blob === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EmptyState({ label }: { label: string }) {
  return <p className="admin-empty-state">{label}</p>;
}

function QuickActionDialog({
  action,
  moduleTitle,
  onClose,
}: {
  action: string;
  moduleTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="admin-action-title" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">{moduleTitle}</span>
            <h2 id="admin-action-title">Быстрое действие</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <div className="admin-action-body">
          <label>
            Действие
            <input readOnly value={action} />
          </label>
          <label>
            Ответственный
            <input readOnly value="Natali" />
          </label>
          <label>
            Статус
            <select defaultValue="draft">
              <option value="draft">Черновик</option>
              <option value="review">На проверке</option>
              <option value="ready">Готово</option>
            </select>
          </label>
        </div>

        <div className="admin-action-footer">
          <button onClick={onClose} type="button">
            Сохранить черновик
          </button>
          <button className="admin-secondary-button" onClick={onClose} type="button">
            Отмена
          </button>
        </div>
      </section>
    </div>
  );
}

function ClientFormDialog({
  clients,
  initialClient,
  onClose,
  onSave,
  role,
}: {
  clients: ClientRecord[];
  initialClient?: ClientRecord;
  onClose: () => void;
  onSave: (client: ClientRecord, originalClientIdentity?: string) => void;
  role: AdminRoleId;
}) {
  const [form, setForm] = useState<ClientFormState>(() => buildClientFormState(initialClient));
  const [error, setError] = useState("");
  const [duplicateClient, setDuplicateClient] = useState<ClientRecord | undefined>();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(initialClient);
  const hasNameError = Boolean(error && !form.name.trim());
  const hasPhoneError = Boolean(error && !form.phone.trim());
  const originalClientIdentity = initialClient?.id ?? initialClient?.phone ?? initialClient?.name;
  const matchingNameClient = findClientNameMatch(clients, form.name, originalClientIdentity);

  function describedBy(...ids: Array<string | false>) {
    const value = ids.filter(Boolean).join(" ");

    return value || undefined;
  }

  function updateForm<Field extends keyof ClientFormState>(field: Field, value: ClientFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setDuplicateClient(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name || !phone) {
      setError("Укажите имя и телефон клиента.");
      if (!name) {
        nameInputRef.current?.focus();
      } else {
        phoneInputRef.current?.focus();
      }
      return;
    }

    const matchingClient = findClientPhoneDuplicate(clients, phone, originalClientIdentity);

    if (matchingClient) {
      setDuplicateClient(matchingClient);
      setError(`Клиент с таким телефоном уже есть: ${matchingClient.name}.`);
      phoneInputRef.current?.focus();
      return;
    }

    const visits = Number.parseInt(form.visits, 10);

    onSave(
      {
        email: form.email.trim(),
        history: initialClient?.history.map((visit) => ({ ...visit })) ?? [],
        id: initialClient?.id ?? buildClientIdFromPhone(phone),
        language: form.language,
        name,
        next: form.next.trim() || "Не назначен",
        note: form.note.trim(),
        phone,
        preferredContact: form.preferredContact,
        status: form.status,
        tags: parseClientTags(form.tags),
        telegram: form.telegram.trim(),
        totalSpend: form.totalSpend.trim() || "0 €",
        visits: Number.isFinite(visits) ? Math.max(visits, 0) : 0,
      },
      originalClientIdentity,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="client-action-title" aria-modal="true" className="admin-action-dialog admin-client-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Клиенты</span>
            <h2 id="client-action-title">{isEditing ? "Редактировать клиента" : "Новый клиент"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-client-form-layout">
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
                {duplicateClient ? (
                  <>
                    {" "}
                    <Link href={clientProfileHref(duplicateClient.id, role)} onClick={onClose}>
                      Открыть карточку существующего клиента
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            {matchingNameClient && !duplicateClient ? (
              <p className="admin-form-warning admin-form-alert-wide" role="status">
                Имя уже есть в базе: {matchingNameClient.name}. Если телефон другой, можно сохранить нового клиента.
              </p>
            ) : null}

            <fieldset className="admin-form-section">
              <legend>Контакты клиента</legend>
              <p className="admin-form-helper" id="client-contact-helper">
                Имя и телефон нужны для записи и связи с клиентом.
              </p>
              <div className="admin-client-form-grid">
                <div className="admin-field">
                  <label htmlFor="client-name-input">Имя</label>
                  <input
                    aria-describedby={describedBy("client-contact-helper", hasNameError && "client-name-error")}
                    aria-invalid={hasNameError ? "true" : undefined}
                    autoComplete="name"
                    id="client-name-input"
                    onChange={(event) => updateForm("name", event.target.value)}
                    ref={nameInputRef}
                    required
                    type="text"
                    value={form.name}
                  />
                  {hasNameError ? (
                    <span className="admin-field-error" id="client-name-error">
                      Укажите имя клиента.
                    </span>
                  ) : null}
                </div>
                <div className="admin-field">
                  <label htmlFor="client-phone-input">Телефон</label>
                  <input
                    aria-describedby={describedBy("client-contact-helper", hasPhoneError && "client-phone-error")}
                    aria-invalid={hasPhoneError ? "true" : undefined}
                    autoComplete="tel"
                    id="client-phone-input"
                    onChange={(event) => updateForm("phone", event.target.value)}
                    ref={phoneInputRef}
                    required
                    type="tel"
                    value={form.phone}
                  />
                  {hasPhoneError ? (
                    <span className="admin-field-error" id="client-phone-error">
                      Укажите телефон клиента.
                    </span>
                  ) : null}
                </div>
                <label>
                  Email
                  <input
                    autoComplete="email"
                    onChange={(event) => updateForm("email", event.target.value)}
                    type="email"
                    value={form.email}
                  />
                </label>
                <label>
                  Telegram
                  <input
                    autoComplete="url"
                    onChange={(event) => updateForm("telegram", event.target.value)}
                    type="url"
                    value={form.telegram}
                  />
                </label>
                <label>
                  Язык
                  <select onChange={(event) => updateForm("language", event.target.value)} value={form.language}>
                    {clientLanguageOptions.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Канал связи
                  <select onChange={(event) => updateForm("preferredContact", event.target.value)} value={form.preferredContact}>
                    {clientContactOptions.map((contact) => (
                      <option key={contact} value={contact}>
                        {contact}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset className="admin-form-section">
              <legend>Профиль и активность</legend>
              <p className="admin-form-helper" id="client-status-helper">
                Активный клиент: 5+ визитов или ближайшая подтвержденная запись.
              </p>
              <div className="admin-client-form-grid">
                <label>
                  Статус
                  <select
                    aria-describedby="client-status-helper"
                    onChange={(event) => updateForm("status", event.target.value)}
                    value={form.status}
                  >
                    {clientStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Следующий визит
                  <input onChange={(event) => updateForm("next", event.target.value)} type="text" value={form.next} />
                </label>
                <label>
                  Визиты
                  <input min="0" onChange={(event) => updateForm("visits", event.target.value)} type="number" value={form.visits} />
                </label>
                <label>
                  Сумма
                  <input onChange={(event) => updateForm("totalSpend", event.target.value)} type="text" value={form.totalSpend} />
                </label>
              </div>
            </fieldset>

            <fieldset className="admin-form-section">
              <legend>Заметки и теги</legend>
              <div className="admin-client-form-grid">
                <label className="admin-form-wide">
                  Заметка клиента
                  <textarea onChange={(event) => updateForm("note", event.target.value)} rows={4} value={form.note} />
                </label>
                <label className="admin-form-wide">
                  Теги
                  <input onChange={(event) => updateForm("tags", event.target.value)} type="text" value={form.tags} />
                </label>
              </div>
            </fieldset>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить клиента"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminUserDialog({
  initialUser,
  onClose,
  onSave,
}: {
  initialUser?: AdminUserRecord;
  onClose: () => void;
  onSave: (user: AdminUserRecord, originalId?: string) => void;
}) {
  const [form, setForm] = useState<AdminUserFormState>(() => buildAdminUserFormState(initialUser));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialUser);

  function updateForm<Field extends keyof AdminUserFormState>(field: Field, value: AdminUserFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !isValidEmail(email)) {
      setError("Укажите имя и корректный email пользователя.");
      return;
    }

    const roleLabel = roleLabels[form.role];
    const nextStatus = form.status;
    const actionLabel = isEditing ? "обновлен" : "приглашен";

    onSave(
      {
        accessNote: form.accessNote.trim() || adminRolePermissionSummary[form.role].scope,
        email,
        history: [
          `2026-07-07: пользователь ${actionLabel}; роль ${roleLabel}, статус ${nextStatus}.`,
          ...(initialUser?.history ?? []),
        ],
        id: initialUser?.id ?? createAdminUserId(name, email),
        lastLogin: form.lastLogin.trim() || "Еще не входил",
        name,
        role: form.role,
        status: nextStatus,
        twoFactor: form.twoFactor,
      },
      initialUser?.id,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="admin-user-action-title" aria-modal="true" className="admin-action-dialog admin-client-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Пользователи</span>
            <h2 id="admin-user-action-title">{isEditing ? "Редактировать пользователя" : "Пригласить пользователя"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-user-form-grid">
            <label>
              Имя
              <input
                aria-invalid={error && !form.name.trim() ? "true" : undefined}
                autoComplete="name"
                onChange={(event) => updateForm("name", event.target.value)}
                required
                type="text"
                value={form.name}
              />
            </label>
            <label>
              Email
              <input
                aria-invalid={error && !isValidEmail(form.email) ? "true" : undefined}
                autoComplete="email"
                onChange={(event) => updateForm("email", event.target.value)}
                required
                type="email"
                value={form.email}
              />
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Роль
              <select onChange={(event) => updateForm("role", event.target.value as AdminRoleId)} value={form.role}>
                {adminRoleOptions.map((roleOption) => (
                  <option key={roleOption.id} value={roleOption.id}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as AdminUserStatus)} value={form.status}>
                {adminUserStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Последний вход
              <input onChange={(event) => updateForm("lastLogin", event.target.value)} type="text" value={form.lastLogin} />
            </label>
            <label className="admin-checkbox-label">
              <input
                checked={form.twoFactor}
                onChange={(event) => updateForm("twoFactor", event.target.checked)}
                type="checkbox"
              />
              2FA включена
            </label>
            <label className="admin-form-wide">
              Комментарий доступа
              <textarea onChange={(event) => updateForm("accessNote", event.target.value)} rows={4} value={form.accessNote} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить пользователя" : "Отправить приглашение"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CertificateFormDialog({
  initialCertificate,
  isCreatePrefill = false,
  onClose,
  onSave,
}: {
  initialCertificate?: CertificateRecord;
  isCreatePrefill?: boolean;
  onClose: () => void;
  onSave: (certificate: CertificateRecord, originalCode?: string) => void;
}) {
  const [form, setForm] = useState<CertificateFormState>(() => buildCertificateFormState(initialCertificate));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialCertificate) && !isCreatePrefill;

  function updateForm<Field extends keyof CertificateFormState>(field: Field, value: CertificateFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = form.code.trim();
    const buyer = form.buyer.trim();
    const recipient = form.recipient.trim();

    if (!code || !buyer || !recipient) {
      setError("Укажите код, покупателя и получателя сертификата.");
      return;
    }

    onSave(
      {
        amount: form.amount.trim() || "0 €",
        buyer,
        clientId: initialCertificate?.clientId,
        clientName: form.clientName.trim() || recipient,
        code,
        expiresAt: form.expiresAt,
        history: isEditing ? (initialCertificate?.history.map((entry) => entry) ?? []) : [`${form.paymentDate}: сертификат создан вручную.`],
        note: form.note.trim(),
        paymentDate: form.paymentDate,
        recipient,
        status: form.status,
        stripeId: form.stripeId.trim() || "manual",
      },
      isEditing ? initialCertificate?.code : undefined,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="certificate-action-title" aria-modal="true" className="admin-action-dialog admin-certificate-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Сертификаты</span>
            <h2 id="certificate-action-title">{isEditing ? "Редактировать сертификат" : "Новый сертификат"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-certificate-form-grid">
            <label>
              Код
              <input
                aria-invalid={error && !form.code.trim() ? "true" : undefined}
                onChange={(event) => updateForm("code", event.target.value)}
                required
                type="text"
                value={form.code}
              />
            </label>
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as CertificateStatus)} value={form.status}>
                {certificateStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Покупатель
              <input
                aria-invalid={error && !form.buyer.trim() ? "true" : undefined}
                onChange={(event) => updateForm("buyer", event.target.value)}
                required
                type="text"
                value={form.buyer}
              />
            </label>
            <label>
              Клиент
              <input onChange={(event) => updateForm("clientName", event.target.value)} type="text" value={form.clientName} />
            </label>
            <label>
              Получатель
              <input
                aria-invalid={error && !form.recipient.trim() ? "true" : undefined}
                onChange={(event) => updateForm("recipient", event.target.value)}
                required
                type="text"
                value={form.recipient}
              />
            </label>
            <label>
              Сумма
              <input onChange={(event) => updateForm("amount", event.target.value)} type="text" value={form.amount} />
            </label>
            <label>
              Stripe ID
              <input onChange={(event) => updateForm("stripeId", event.target.value)} type="text" value={form.stripeId} />
            </label>
            <label>
              Дата оплаты
              <input onChange={(event) => updateForm("paymentDate", event.target.value)} type="date" value={form.paymentDate} />
            </label>
            <label>
              Действителен до
              <input onChange={(event) => updateForm("expiresAt", event.target.value)} type="date" value={form.expiresAt} />
            </label>
            <label className="admin-form-wide">
              Заметка
              <textarea onChange={(event) => updateForm("note", event.target.value)} rows={4} value={form.note} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить сертификат"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ServiceFormDialog({
  initialService,
  onClose,
  onSave,
}: {
  initialService?: ServiceRecord;
  onClose: () => void;
  onSave: (service: ServiceRecord, originalSlug?: string) => void;
}) {
  const [form, setForm] = useState<ServiceFormState>(() => buildServiceFormState(initialService));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialService);

  function updateForm<Field extends keyof ServiceFormState>(field: Field, value: ServiceFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const slug = form.slug.trim();

    if (!name || !slug) {
      setError("Укажите название и slug услуги.");
      return;
    }

    onSave(
      {
        category: form.category.trim() || "Массаж",
        coverImage: form.coverImage.trim(),
        duration: form.duration.trim() || "60 мин",
        locales: parseCommaList(form.locales),
        name,
        order: Number.parseInt(form.order, 10) || 1,
        seoTitle: form.seoTitle.trim() || name,
        slug,
        status: form.status,
        summary: form.summary.trim(),
      },
      initialService?.slug,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="service-action-title" aria-modal="true" className="admin-action-dialog admin-service-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Виды массажа</span>
            <h2 id="service-action-title">{isEditing ? "Редактировать услугу" : "Новая услуга"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Название
              <input
                aria-invalid={error && !form.name.trim() ? "true" : undefined}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                type="text"
                value={form.name}
              />
            </label>
            <label>
              Slug
              <input
                aria-invalid={error && !form.slug.trim() ? "true" : undefined}
                onChange={(event) => updateForm("slug", event.target.value)}
                required
                type="text"
                value={form.slug}
              />
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Категория
              <input onChange={(event) => updateForm("category", event.target.value)} type="text" value={form.category} />
            </label>
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as ServiceStatus)} value={form.status}>
                {serviceStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Длительность
              <input onChange={(event) => updateForm("duration", event.target.value)} type="text" value={form.duration} />
            </label>
            <label>
              Порядок
              <input onChange={(event) => updateForm("order", event.target.value)} type="number" value={form.order} />
            </label>
            <label>
              Локали
              <input onChange={(event) => updateForm("locales", event.target.value)} type="text" value={form.locales} />
            </label>
            <label>
              SEO title
              <input onChange={(event) => updateForm("seoTitle", event.target.value)} type="text" value={form.seoTitle} />
            </label>
            <label className="admin-form-wide">
              Обложка
              <input onChange={(event) => updateForm("coverImage", event.target.value)} type="text" value={form.coverImage} />
            </label>
            <label className="admin-form-wide">
              Описание
              <textarea onChange={(event) => updateForm("summary", event.target.value)} rows={4} value={form.summary} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить услугу"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PriceFormDialog({
  initialPrice,
  onClose,
  onSave,
  services,
}: {
  initialPrice?: PriceRecord;
  onClose: () => void;
  onSave: (price: PriceRecord, originalId?: string) => void;
  services: ServiceRecord[];
}) {
  const [form, setForm] = useState<PriceFormState>(() => buildPriceFormState(services, initialPrice));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialPrice);

  function updateForm<Field extends keyof PriceFormState>(field: Field, value: PriceFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const durationMinutes = Number.parseInt(form.durationMinutes, 10);
    const priceEur = Number.parseFloat(form.priceEur.replace(",", "."));

    if (!form.serviceSlug || !durationMinutes || !Number.isFinite(priceEur) || priceEur <= 0) {
      setError("Укажите услугу, длительность и цену.");
      return;
    }

    onSave(
      {
        durationMinutes,
        id: initialPrice?.id ?? `price-${form.serviceSlug}-${durationMinutes}`,
        note: form.note.trim(),
        order: Number.parseInt(form.order, 10) || 1,
        priceEur,
        serviceSlug: form.serviceSlug,
        status: form.status,
        updatedAt: form.updatedAt,
      },
      initialPrice?.id,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="price-action-title" aria-modal="true" className="admin-action-dialog admin-price-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Прайс</span>
            <h2 id="price-action-title">{isEditing ? "Редактировать цену" : "Новая цена"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Услуга
              <select onChange={(event) => updateForm("serviceSlug", event.target.value)} value={form.serviceSlug}>
                {services.map((service) => (
                  <option key={service.slug} value={service.slug}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as PriceStatus)} value={form.status}>
                {priceStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Длительность
              <input onChange={(event) => updateForm("durationMinutes", event.target.value)} type="number" value={form.durationMinutes} />
            </label>
            <label>
              Цена
              <input onChange={(event) => updateForm("priceEur", event.target.value)} type="number" value={form.priceEur} />
            </label>
            <label>
              Порядок
              <input onChange={(event) => updateForm("order", event.target.value)} type="number" value={form.order} />
            </label>
            <label>
              Обновлено
              <input onChange={(event) => updateForm("updatedAt", event.target.value)} type="date" value={form.updatedAt} />
            </label>
            <label className="admin-form-wide">
              Заметка
              <textarea onChange={(event) => updateForm("note", event.target.value)} rows={4} value={form.note} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить цену"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MediaFormDialog({
  initialMedia,
  onClose,
  onSave,
}: {
  initialMedia?: MediaRecord;
  onClose: () => void;
  onSave: (media: MediaRecord, originalId?: string) => void;
}) {
  const [form, setForm] = useState<MediaFormState>(() => buildMediaFormState(initialMedia));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialMedia);

  function updateForm<Field extends keyof MediaFormState>(field: Field, value: MediaFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const url = form.url.trim();

    if (!name || !url) {
      setError("Укажите название и URL медиа.");
      return;
    }

    onSave(
      {
        altText: form.altText.trim(),
        dimensions: form.dimensions.trim(),
        folder: form.folder.trim() || "media",
        id: initialMedia?.id ?? createMediaId(name, url),
        name,
        size: form.size.trim(),
        status: form.status,
        type: form.type,
        uploadedAt: form.uploadedAt,
        url,
        usage: parseCommaList(form.usage),
      },
      initialMedia?.id,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="media-action-title" aria-modal="true" className="admin-action-dialog admin-media-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Медиа</span>
            <h2 id="media-action-title">{isEditing ? "Редактировать медиа" : "Новое медиа"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Название
              <input
                aria-invalid={error && !form.name.trim() ? "true" : undefined}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                type="text"
                value={form.name}
              />
            </label>
            <label>
              Папка
              <input onChange={(event) => updateForm("folder", event.target.value)} type="text" value={form.folder} />
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label className="admin-form-wide">
              URL
              <input
                aria-invalid={error && !form.url.trim() ? "true" : undefined}
                onChange={(event) => updateForm("url", event.target.value)}
                required
                type="text"
                value={form.url}
              />
            </label>
            <label>
              Тип
              <select onChange={(event) => updateForm("type", event.target.value as MediaType)} value={form.type}>
                {mediaTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as MediaStatus)} value={form.status}>
                {mediaStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Размер файла
              <input onChange={(event) => updateForm("size", event.target.value)} type="text" value={form.size} />
            </label>
            <label>
              Разрешение
              <input onChange={(event) => updateForm("dimensions", event.target.value)} type="text" value={form.dimensions} />
            </label>
            <label>
              Загружено
              <input onChange={(event) => updateForm("uploadedAt", event.target.value)} type="date" value={form.uploadedAt} />
            </label>
            <label className="admin-form-wide">
              Alt-текст
              <textarea onChange={(event) => updateForm("altText", event.target.value)} rows={3} value={form.altText} />
            </label>
            <label className="admin-form-wide">
              Использование
              <textarea onChange={(event) => updateForm("usage", event.target.value)} rows={3} value={form.usage} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить медиа"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ContactSettingsDialog({
  settings,
  onClose,
  onSave,
}: {
  settings: ContactSettingsRecord;
  onClose: () => void;
  onSave: (settings: ContactSettingsRecord) => void;
}) {
  const [form, setForm] = useState<ContactSettingsRecord>(() => buildContactSettingsFormState(settings));
  const [error, setError] = useState("");

  function updateForm<Field extends keyof ContactSettingsRecord>(field: Field, value: ContactSettingsRecord[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.businessName.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Укажите название, телефон и адрес салона.");
      return;
    }

    onSave({
      address: form.address.trim(),
      bookingUrl: form.bookingUrl.trim(),
      businessName: form.businessName.trim(),
      email: form.email.trim(),
      mapUrl: form.mapUrl.trim(),
      phone: form.phone.trim(),
      seoArea: form.seoArea.trim(),
      workingHours: form.workingHours.trim(),
    });
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="contact-settings-title" aria-modal="true" className="admin-action-dialog admin-contact-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Контакты</span>
            <h2 id="contact-settings-title">Контактные настройки</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Название
              <input
                aria-invalid={error && !form.businessName.trim() ? "true" : undefined}
                onChange={(event) => updateForm("businessName", event.target.value)}
                required
                type="text"
                value={form.businessName}
              />
            </label>
            <label>
              Телефон
              <input
                aria-invalid={error && !form.phone.trim() ? "true" : undefined}
                autoComplete="tel"
                onChange={(event) => updateForm("phone", event.target.value)}
                required
                type="tel"
                value={form.phone}
              />
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label className="admin-form-wide">
              Адрес
              <input
                aria-invalid={error && !form.address.trim() ? "true" : undefined}
                autoComplete="street-address"
                onChange={(event) => updateForm("address", event.target.value)}
                required
                type="text"
                value={form.address}
              />
            </label>
            <label>
              Email
              <input autoComplete="email" onChange={(event) => updateForm("email", event.target.value)} type="email" value={form.email} />
            </label>
            <label>
              Часы работы
              <input onChange={(event) => updateForm("workingHours", event.target.value)} type="text" value={form.workingHours} />
            </label>
            <label className="admin-form-wide">
              Studio24 URL
              <input onChange={(event) => updateForm("bookingUrl", event.target.value)} type="url" value={form.bookingUrl} />
            </label>
            <label className="admin-form-wide">
              Map URL
              <input onChange={(event) => updateForm("mapUrl", event.target.value)} type="url" value={form.mapUrl} />
            </label>
            <label className="admin-form-wide">
              LocalBusiness area
              <input onChange={(event) => updateForm("seoArea", event.target.value)} type="text" value={form.seoArea} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">Сохранить контакты</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ContactChannelDialog({
  initialChannel,
  onClose,
  onSave,
}: {
  initialChannel?: ContactChannelRecord;
  onClose: () => void;
  onSave: (channel: ContactChannelRecord, originalId?: string) => void;
}) {
  const [form, setForm] = useState<ContactChannelFormState>(() => buildContactChannelFormState(initialChannel));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialChannel);

  function updateForm<Field extends keyof ContactChannelFormState>(field: Field, value: ContactChannelFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const value = form.value.trim();

    if (!name || !value) {
      setError("Укажите название и значение контакта.");
      return;
    }

    onSave(
      {
        id: initialChannel?.id ?? createContactChannelId(name, value),
        name,
        note: form.note.trim(),
        status: form.status,
        type: form.type,
        usage: parseCommaList(form.usage),
        value,
      },
      initialChannel?.id,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="contact-channel-title" aria-modal="true" className="admin-action-dialog admin-contact-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Контакты</span>
            <h2 id="contact-channel-title">{isEditing ? "Редактировать контакт" : "Новый контакт"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Название
              <input
                aria-invalid={error && !form.name.trim() ? "true" : undefined}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                type="text"
                value={form.name}
              />
            </label>
            <label>
              Тип
              <select onChange={(event) => updateForm("type", event.target.value as ContactChannelType)} value={form.type}>
                {contactChannelTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as ContactStatus)} value={form.status}>
                {contactStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-form-wide">
              Значение
              <input
                aria-invalid={error && !form.value.trim() ? "true" : undefined}
                onChange={(event) => updateForm("value", event.target.value)}
                required
                type="text"
                value={form.value}
              />
            </label>
            <label className="admin-form-wide">
              Места использования
              <textarea onChange={(event) => updateForm("usage", event.target.value)} rows={3} value={form.usage} />
            </label>
            <label className="admin-form-wide">
              Заметка
              <textarea onChange={(event) => updateForm("note", event.target.value)} rows={3} value={form.note} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить контакт"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function BlogPostDialog({
  initialPost,
  onClose,
  onSave,
}: {
  initialPost?: BlogPostRecord;
  onClose: () => void;
  onSave: (post: BlogPostRecord, originalId?: string) => void;
}) {
  const [form, setForm] = useState<BlogPostFormState>(() => buildBlogPostFormState(initialPost));
  const [error, setError] = useState("");
  const isEditing = Boolean(initialPost);

  function updateForm<Field extends keyof BlogPostFormState>(field: Field, value: BlogPostFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = form.title.trim();
    const slug = form.slug.trim();

    if (!title || !slug) {
      setError("Укажите заголовок и slug статьи.");
      return;
    }

    onSave(
      {
        author: form.author.trim() || "Natali",
        body: form.body.trim(),
        category: form.category.trim() || "Общее",
        coverImage: form.coverImage.trim(),
        excerpt: form.excerpt.trim(),
        id: initialPost?.id ?? createBlogPostId(title, slug),
        locales: parseCommaList(form.locales),
        publishedAt: form.publishedAt,
        seoTitle: form.seoTitle.trim() || title,
        slug,
        status: form.status,
        tags: parseCommaList(form.tags),
        title,
        updatedAt: "2026-07-07",
      },
      initialPost?.id,
    );
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="blog-action-title" aria-modal="true" className="admin-action-dialog admin-service-form-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Блог</span>
            <h2 id="blog-action-title">{isEditing ? "Редактировать статью" : "Новая статья"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Заголовок
              <input
                aria-invalid={error && !form.title.trim() ? "true" : undefined}
                onChange={(event) => updateForm("title", event.target.value)}
                required
                type="text"
                value={form.title}
              />
            </label>
            <label>
              Slug
              <input
                aria-invalid={error && !form.slug.trim() ? "true" : undefined}
                onChange={(event) => updateForm("slug", event.target.value)}
                required
                type="text"
                value={form.slug}
              />
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Категория
              <input onChange={(event) => updateForm("category", event.target.value)} type="text" value={form.category} />
            </label>
            <label>
              Статус
              <select onChange={(event) => updateForm("status", event.target.value as BlogStatus)} value={form.status}>
                {blogStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Автор
              <input onChange={(event) => updateForm("author", event.target.value)} type="text" value={form.author} />
            </label>
            <label>
              Дата публикации
              <input onChange={(event) => updateForm("publishedAt", event.target.value)} type="date" value={form.publishedAt} />
            </label>
            <label>
              Локали
              <input onChange={(event) => updateForm("locales", event.target.value)} type="text" value={form.locales} />
            </label>
            <label>
              SEO title
              <input onChange={(event) => updateForm("seoTitle", event.target.value)} type="text" value={form.seoTitle} />
            </label>
            <label className="admin-form-wide">
              Обложка
              <input onChange={(event) => updateForm("coverImage", event.target.value)} type="text" value={form.coverImage} />
            </label>
            <label className="admin-form-wide">
              Краткое описание
              <textarea onChange={(event) => updateForm("excerpt", event.target.value)} rows={3} value={form.excerpt} />
            </label>
            <label className="admin-form-wide">
              Текст статьи
              <textarea onChange={(event) => updateForm("body", event.target.value)} rows={5} value={form.body} />
            </label>
            <label className="admin-form-wide">
              Теги
              <input onChange={(event) => updateForm("tags", event.target.value)} type="text" value={form.tags} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить статью"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SettingsDialog({
  onClose,
  onSave,
  settings,
}: {
  onClose: () => void;
  onSave: (settings: SettingsRecord) => void;
  settings: SettingsRecord;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState<SettingsFormState>(() => buildSettingsFormState(settings));
  const [error, setError] = useState("");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function updateForm<Field extends keyof SettingsFormState>(field: Field, value: SettingsFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const bookingBufferMinutes = Number(form.bookingBufferMinutes);
    const dailySlotCapacity = Number(form.dailySlotCapacity);
    const auditLogRetentionDays = Number(form.auditLogRetentionDays);

    if (
      !form.businessName.trim() ||
      !isPositiveInteger(bookingBufferMinutes) ||
      !isPositiveInteger(dailySlotCapacity) ||
      !isPositiveInteger(auditLogRetentionDays)
    ) {
      setError("Укажите название, буфер записи, слоты и срок хранения audit log.");
      return;
    }

    onSave({
      auditLogRetentionDays,
      bookingBufferMinutes,
      businessName: form.businessName.trim(),
      cookiePrivacyMode: form.cookiePrivacyMode.trim(),
      currency: form.currency,
      dailySlotCapacity,
      defaultLocale: form.defaultLocale,
      defaultSeoTitle: form.defaultSeoTitle.trim(),
      emailSender: form.emailSender.trim(),
      googleCalendarId: form.googleCalendarId.trim(),
      googleCalendarMode: form.googleCalendarMode,
      reminderTemplate: form.reminderTemplate.trim(),
      rolesPolicy: form.rolesPolicy.trim(),
      stripeMode: form.stripeMode,
      timezone: form.timezone.trim(),
      updatedAt: "2026-07-07",
      workingDays: form.workingDays.trim(),
      workingHours: form.workingHours.trim(),
    });
  }

  return (
    <div className="admin-action-backdrop">
      <section
        aria-labelledby="settings-action-title"
        aria-modal="true"
        className="admin-action-dialog admin-service-form-dialog"
        onKeyDown={trapDialogFocus}
        role="dialog"
      >
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Настройки</span>
            <h2 id="settings-action-title" ref={titleRef} tabIndex={-1}>
              Настройки админки
            </h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body admin-content-form-grid">
            <label>
              Название бизнеса
              <input
                aria-invalid={error && !form.businessName.trim() ? "true" : undefined}
                onChange={(event) => updateForm("businessName", event.target.value)}
                required
                type="text"
                value={form.businessName}
              />
            </label>
            <label>
              Язык по умолчанию
              <select onChange={(event) => updateForm("defaultLocale", event.target.value)} value={form.defaultLocale}>
                {clientLanguageOptions.map((locale) => (
                  <option key={locale.value} value={locale.value}>
                    {locale.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Часовой пояс
              <input onChange={(event) => updateForm("timezone", event.target.value)} type="text" value={form.timezone} />
            </label>
            <label>
              Рабочие дни
              <input onChange={(event) => updateForm("workingDays", event.target.value)} type="text" value={form.workingDays} />
            </label>
            <label>
              Рабочие часы
              <input onChange={(event) => updateForm("workingHours", event.target.value)} type="text" value={form.workingHours} />
            </label>
            <label>
              Перерыв между сеансами
              <input
                aria-invalid={error && !isPositiveInteger(Number(form.bookingBufferMinutes)) ? "true" : undefined}
                min={1}
                onChange={(event) => updateForm("bookingBufferMinutes", event.target.value)}
                required
                step={1}
                type="number"
                value={form.bookingBufferMinutes}
              />
            </label>
            <label>
              Слотов в день
              <input
                aria-invalid={error && !isPositiveInteger(Number(form.dailySlotCapacity)) ? "true" : undefined}
                min={1}
                onChange={(event) => updateForm("dailySlotCapacity", event.target.value)}
                required
                step={1}
                type="number"
                value={form.dailySlotCapacity}
              />
            </label>
            <label>
              Google Calendar
              <select onChange={(event) => updateForm("googleCalendarMode", event.target.value as CalendarSyncMode)} value={form.googleCalendarMode}>
                {calendarSyncModeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Google Calendar ID
              <input onChange={(event) => updateForm("googleCalendarId", event.target.value)} type="text" value={form.googleCalendarId} />
            </label>
            <label>
              Валюта
              <select onChange={(event) => updateForm("currency", event.target.value as "EUR")} value={form.currency}>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label>
              Stripe режим
              <select onChange={(event) => updateForm("stripeMode", event.target.value as StripeMode)} value={form.stripeMode}>
                {stripeModeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Email отправителя
              <input onChange={(event) => updateForm("emailSender", event.target.value)} type="email" value={form.emailSender} />
            </label>
            <label>
              Хранение audit log
              <input
                aria-invalid={error && !isPositiveInteger(Number(form.auditLogRetentionDays)) ? "true" : undefined}
                min={1}
                onChange={(event) => updateForm("auditLogRetentionDays", event.target.value)}
                step={1}
                type="number"
                value={form.auditLogRetentionDays}
              />
            </label>
            <label className="admin-form-wide">
              SEO title
              <input onChange={(event) => updateForm("defaultSeoTitle", event.target.value)} type="text" value={form.defaultSeoTitle} />
            </label>
            <label className="admin-form-wide">
              Cookie/privacy
              <textarea onChange={(event) => updateForm("cookiePrivacyMode", event.target.value)} rows={3} value={form.cookiePrivacyMode} />
            </label>
            <label className="admin-form-wide">
              Шаблон напоминания
              <textarea onChange={(event) => updateForm("reminderTemplate", event.target.value)} rows={3} value={form.reminderTemplate} />
            </label>
            <label className="admin-form-wide">
              Политика ролей
              <textarea onChange={(event) => updateForm("rolesPolicy", event.target.value)} rows={3} value={form.rolesPolicy} />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">Сохранить настройки</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DangerousSettingsDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="admin-action-backdrop">
      <section
        aria-labelledby="danger-settings-title"
        aria-modal="true"
        className="admin-action-dialog"
        onKeyDown={trapDialogFocus}
        role="dialog"
      >
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Опасная зона</span>
            <h2 id="danger-settings-title" ref={titleRef} tabIndex={-1}>
              Подтвердить действие
            </h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
        <div className="admin-action-body">
          <p>Опасное действие не выполняется без подтверждения владельца.</p>
          <p>Для v1 это действие только фиксируется в audit log и не удаляет реальные данные.</p>
        </div>
        <div className="admin-action-footer">
          <button className="admin-danger-button" onClick={onConfirm} type="button">
            Подтвердить
          </button>
          <button className="admin-secondary-button" onClick={onClose} type="button">
            Отмена
          </button>
        </div>
      </section>
    </div>
  );
}

function CalendarAppointmentDialog({
  clients,
  initialAppointment,
  onClose,
  onSave,
  prefillClient,
  prefillClientName,
  prefillDate,
}: {
  clients: ClientRecord[];
  initialAppointment?: Appointment;
  onClose: () => void;
  onSave: (appointment: Appointment) => void;
  prefillClient?: ClientRecord;
  prefillClientName?: string;
  prefillDate?: string;
}) {
  const [form, setForm] = useState<Appointment>({
    client: initialAppointment?.client ?? prefillClient?.name ?? prefillClientName ?? "",
    clientId: initialAppointment?.clientId ?? prefillClient?.id,
    date: initialAppointment?.date ?? prefillDate ?? "2026-07-06",
    id: initialAppointment?.id,
    note: initialAppointment?.note ?? "",
    service: initialAppointment?.service ?? appointmentServiceOptions[0],
    status: initialAppointment?.status ?? "Новая заявка",
    time: initialAppointment?.time ?? "14:00",
  });
  const [error, setError] = useState("");
  const isEditing = Boolean(initialAppointment);
  const normalizedClientQuery = normalizeSearch(form.client);
  const clientSuggestions =
    normalizedClientQuery.length > 0
      ? clients
          .filter(
            (client) =>
              normalizeSearch(client.name).includes(normalizedClientQuery) ||
              normalizeSearch(client.phone).includes(normalizedClientQuery) ||
              normalizeSearch(client.email).includes(normalizedClientQuery),
          )
          .filter((client) => normalizeSearch(client.name) !== normalizedClientQuery)
          .sort((first, second) => first.name.localeCompare(second.name, "ru"))
          .slice(0, 4)
      : [];

  function updateForm<Field extends keyof Appointment>(field: Field, value: Appointment[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function updateClientInput(value: string) {
    const linkedClient = findClientByIdentity(clients, value) ?? findUniqueClientByName(clients, value);

    setForm((current) => ({ ...current, client: value, clientId: linkedClient?.id }));
    setError("");
  }

  function selectClient(client: ClientRecord) {
    setForm((current) => ({ ...current, client: client.name, clientId: client.id }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const client = form.client.trim();

    if (!client || !form.date || !form.time) {
      setError("Укажите клиента, дату и время.");
      return;
    }

    const linkedClient = findClientByIdentity(clients, form.clientId) ?? findUniqueClientByName(clients, client);

    onSave({ ...form, client, clientId: linkedClient?.id, note: form.note.trim() });
    onClose();
  }

  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="calendar-action-title" aria-modal="true" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-action-title">{isEditing ? "Редактировать запись" : "Новая запись"}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="admin-action-body">
            <label>
              Клиент
              <input
                aria-invalid={error && !form.client.trim() ? "true" : undefined}
                autoComplete="name"
                onChange={(event) => updateClientInput(event.target.value)}
                required
                type="text"
                value={form.client}
              />
            </label>
            {clientSuggestions.length > 0 ? (
              <div aria-label="Найденные клиенты" className="admin-client-suggestions" role="listbox">
                {clientSuggestions.map((client) => (
                  <button
                    aria-selected="false"
                    key={client.id}
                    onClick={() => selectClient(client)}
                    role="option"
                    type="button"
                  >
                    <span>{client.name}</span>
                    <small>
                      {client.phone} · {client.language.toUpperCase()}
                    </small>
                  </button>
                ))}
              </div>
            ) : null}
            {error ? (
              <p className="admin-form-alert" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Услуга
              <select onChange={(event) => updateForm("service", event.target.value)} value={form.service}>
                {appointmentServiceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Дата
              <input
                aria-invalid={error && !form.date ? "true" : undefined}
                onChange={(event) => updateForm("date", event.target.value)}
                required
                type="date"
                value={form.date}
              />
            </label>
            <label>
              Время
              <input
                aria-invalid={error && !form.time ? "true" : undefined}
                onChange={(event) => updateForm("time", event.target.value)}
                required
                type="time"
                value={form.time}
              />
            </label>
            <label>
              Статус
              <select
                onChange={(event) => updateForm("status", event.target.value as AppointmentStatus)}
                value={form.status}
              >
                {appointmentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Комментарий к записи
              <textarea
                onChange={(event) => updateForm("note", event.target.value)}
                rows={3}
                value={form.note}
              />
            </label>
          </div>

          <div className="admin-action-footer">
            <button type="submit">{isEditing ? "Сохранить изменения" : "Сохранить запись"}</button>
            <button className="admin-secondary-button" onClick={onClose} type="button">
              Отмена
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CalendarAppointmentCancelDialog({
  appointment,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  onClose: () => void;
  onConfirm: (appointment: Appointment) => void;
}) {
  return (
    <div className="admin-action-backdrop">
      <section aria-labelledby="calendar-cancel-title" aria-modal="true" className="admin-action-dialog" role="dialog">
        <div className="admin-panel-head">
          <div>
            <span className="admin-kicker">Календарь</span>
            <h2 id="calendar-cancel-title">Отменить запись</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <p className="admin-confirm-copy">
          Запись клиента <strong>{appointment.client}</strong> на {formatCalendarDay(appointment.date)} в{" "}
          <strong>{appointment.time}</strong> будет отмечена как отмененная. История останется в календаре.
        </p>
        <div className="admin-confirm-summary" aria-label="Запись для отмены">
          <span>{appointment.service}</span>
          <span className={statusClass(appointment.status)}>{appointment.status}</span>
        </div>

        <div className="admin-action-footer">
          <button className="admin-danger-action" onClick={() => onConfirm(appointment)} type="button">
            Подтвердить отмену
          </button>
          <button className="admin-secondary-button" onClick={onClose} type="button">
            Оставить запись
          </button>
        </div>
      </section>
    </div>
  );
}

function DashboardWorkspace({
  appointments,
  certificates,
  clients,
  query,
  role,
}: {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  query: string;
  role: AdminRoleId;
}) {
  const filteredAppointments = appointments.filter((appointment) =>
    matchesSearch([appointment.time, appointment.client, appointment.service, appointment.status], query),
  );
  const filteredCertificates = certificates.filter((certificate) =>
    matchesSearch([certificate.code, certificate.buyer, certificate.clientName, certificate.recipient, certificate.status], query),
  );
  const nextCertificateToSend = certificates.find((certificate) => certificate.status === "Ожидает PDF");
  const operationItems = [
    ...(canAccessAdminSection("calendar", role)
      ? [
          {
            href: `/admin?section=calendar&role=${role}&action=create`,
            label: "Создать запись",
            note: "Быстро открыть чистую форму записи.",
          },
        ]
      : []),
    ...(canAccessAdminSection("clients", role)
      ? [
          {
            href: adminSectionHref("clients", role),
            label: "Открыть клиентов",
            note: "Найти карточку клиента, контакты и историю.",
          },
        ]
      : []),
    ...(canAccessAdminSection("certificates", role)
      ? [
          {
            href: nextCertificateToSend
              ? certificateDetailHref(nextCertificateToSend.code, role)
              : adminSectionHref("certificates", role),
            label: "Сертификаты к отправке",
            note: nextCertificateToSend
              ? `${nextCertificateToSend.code}: проверить PDF, статус и отправку.`
              : "Проверить PDF, статусы и погашения.",
          },
        ]
      : []),
    ...(canAccessAdminSection("finances", role)
      ? [
          {
            href: adminSectionHref("finances", role),
            label: "Выгрузить Stripe",
            note: "Продажи, комиссии, возвраты и net за период.",
          },
        ]
      : []),
    ...(canAccessAdminSection("users", role)
      ? [
          {
            href: adminSectionHref("users", role),
            label: "Пользователи и роли",
            note: "Проверить доступы сотрудников и бухгалтера.",
          },
        ]
      : []),
    ...(canAccessAdminSection("settings", role)
      ? [
          {
            href: adminSectionHref("settings", role),
            label: "Настройки календаря",
            note: "Буфер между сеансами, рабочее время и правила записи.",
          },
        ]
      : []),
  ];

  return (
    <div className="admin-dashboard-grid">
      <section className="admin-metric-row" aria-label="Ключевые показатели">
        {dashboardMetrics.map((metric) => (
          <article className={`admin-metric admin-metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel admin-panel-large" aria-labelledby="appointments-heading">
        <div className="admin-panel-head">
          <h2 id="appointments-heading">Ближайшие записи</h2>
          <Link className="admin-text-action" href={`/admin?section=calendar&role=${role}`}>
            Открыть календарь
          </Link>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Клиент</th>
                <th>Услуга</th>
                <th>Статус</th>
                <th>Раздел</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appointment) => {
                const appointmentClient = findAppointmentClient(clients, appointment);
                const appointmentClientIdentity = appointmentClient?.id ?? appointment.client;

                return (
                  <tr key={appointmentKey(appointment)}>
                    <td className="admin-tabular">{appointment.time}</td>
                    <td>
                      <Link className="admin-row-action admin-row-link" href={clientProfileHref(appointmentClientIdentity, role)}>
                        {appointment.client}
                      </Link>
                    </td>
                    <td>{appointment.service}</td>
                    <td>
                      <span className={statusClass(appointment.status)}>{appointment.status}</span>
                    </td>
                    <td>
                      <Link className="admin-row-action admin-row-link" href={calendarAppointmentHref(appointment, role, appointmentClientIdentity)}>
                        Календарь
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAppointments.length === 0 ? <EmptyState label="По этому запросу записей нет." /> : null}
      </section>

      <section className="admin-panel" aria-labelledby="certificate-heading">
        <div className="admin-panel-head">
          <h2 id="certificate-heading">Сертификаты</h2>
          <Link className="admin-text-action" href={`/admin?section=certificates&role=${role}`}>
            Все
          </Link>
        </div>
        <div className="admin-list">
          {filteredCertificates.map((certificate) => (
            <article className="admin-list-item" key={certificate.code}>
              <div>
                <strong>
                  <Link className="admin-row-action admin-row-link" href={certificateDetailHref(certificate.code, role)}>
                    {certificate.code}
                  </Link>
                </strong>
                <span>
                  {certificate.buyer} → {certificate.recipient}
                </span>
              </div>
              <span className={statusClass(certificate.status)}>{certificate.status}</span>
            </article>
          ))}
        </div>
        {filteredCertificates.length === 0 ? <EmptyState label="Сертификаты не найдены." /> : null}
      </section>

      <section className="admin-panel" aria-labelledby="dashboard-queue-heading">
        <div className="admin-panel-head">
          <h2 id="dashboard-queue-heading">Операционная очередь</h2>
        </div>
        <div className="admin-list">
          {operationItems.map((item) => (
            <Link className="admin-list-item admin-list-link" href={item.href} key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.note}</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClientDetailCard({
  appointments,
  certificates,
  client,
  onCalendarCreateIntent,
  onClose,
  onEditClient,
  onIssueCertificate,
  onSaveNote,
  role,
}: {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  client: ClientRecord;
  onCalendarCreateIntent: () => void;
  onClose: () => void;
  onEditClient: (client: ClientRecord) => void;
  onIssueCertificate: (client: ClientRecord) => void;
  onSaveNote: (clientId: string, note: string) => void;
  role: AdminRoleId;
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [activeFeedFilter, setActiveFeedFilter] = useState<ClientFeedFilterId>("all");
  const [draftNote, setDraftNote] = useState(client.note);
  const [saveNotice, setSaveNotice] = useState("");
  const clientInitials = client.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const activity = clientActivitySummary(client);
  const nextAppointment = findClientNextAppointment(appointments);
  const lastCompletedVisit = findClientLastCompletedVisit(client);
  const activeCertificate = findClientActiveCertificate(certificates);
  const nextClientAction = buildClientNextAction(client, nextAppointment, activeCertificate, role);
  const shouldShowVisits = activeFeedFilter === "all" || activeFeedFilter === "visits";
  const shouldShowCertificates = activeFeedFilter === "all" || activeFeedFilter === "certificates";
  const shouldShowNotes = activeFeedFilter === "all" || activeFeedFilter === "notes";
  const hasVisibleFeedItems =
    (shouldShowVisits && client.history.length > 0) ||
    (shouldShowCertificates && certificates.length > 0) ||
    (shouldShowNotes && Boolean(client.note));

  function startNoteEdit() {
    setDraftNote(client.note);
    setSaveNotice("");
    setIsEditingNote(true);
  }

  function cancelNoteEdit() {
    setDraftNote(client.note);
    setIsEditingNote(false);
  }

  function handleNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextNote = draftNote.trim();
    onSaveNote(client.id, nextNote);
    setDraftNote(nextNote);
    setIsEditingNote(false);
    setSaveNotice("Заметка сохранена.");
  }

  return (
    <aside
      aria-label="Карточка клиента"
      aria-modal="true"
      className="admin-panel admin-client-card admin-drawer-panel"
      role="dialog"
    >
      <div className="admin-panel-head">
        <span className="admin-kicker">Карточка клиента</span>
        <button className="admin-icon-button" onClick={onClose} type="button">
          Закрыть
        </button>
      </div>
      <div className="admin-client-profile-head">
        <span className="admin-client-avatar" aria-hidden="true">
          {clientInitials}
        </span>
        <div>
          <h2 id="admin-client-card-title">{client.name}</h2>
          <p>
            {client.language.toUpperCase()} · {client.status}
          </p>
        </div>
      </div>

      <div className="admin-client-activity" aria-label="Активность клиента">
        <span className={activity.isActive ? "admin-status admin-status-success" : "admin-status admin-status-warning"}>
          {activity.isActive ? "В активных" : "Не в активных"}
        </span>
        <strong>{activity.reason}</strong>
        <small>{activity.details}</small>
        <small>{activity.nextVisit}</small>
      </div>

      <dl className="admin-client-contact-list">
        <div>
          <dt>Телефон</dt>
          <dd className="admin-tabular">{client.phone}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{client.email}</dd>
        </div>
        <div>
          <dt>Канал связи</dt>
          <dd>{client.preferredContact}</dd>
        </div>
      </dl>

      <div className="admin-client-actions" aria-label="Быстрые действия клиента">
        <Link className="admin-text-action" href={calendarCreateHref(client.id, role)} onClick={onCalendarCreateIntent}>
          Записать клиента
        </Link>
        <button className="admin-outline-action" onClick={() => onEditClient(client)} type="button">
          Редактировать клиента
        </button>
        <button className="admin-outline-action" onClick={() => onIssueCertificate(client)} type="button">
          Выдать сертификат
        </button>
        <a className="admin-outline-action" href={phoneHref(client.phone)}>
          Позвонить
        </a>
        <a className="admin-outline-action" href={`mailto:${client.email}`}>
          Email
        </a>
        <a className="admin-outline-action" href={client.telegram} rel="noreferrer" target="_blank">
          Telegram
        </a>
      </div>

      <div className="admin-client-metrics" aria-label="Показатели клиента">
        <div>
          <span>Визиты</span>
          <strong>{client.visits}</strong>
        </div>
        <div>
          <span>Следующий</span>
          <strong>{client.next}</strong>
        </div>
        <div>
          <span>Сумма</span>
          <strong>{client.totalSpend}</strong>
        </div>
      </div>

      <section className="admin-client-section admin-client-next-action" aria-label="Следующее действие клиента">
        <div className="admin-client-next-action-copy">
          <span className="admin-feed-type">{nextClientAction.typeLabel}</span>
          <h3>{nextClientAction.title}</h3>
          <p>{nextClientAction.description}</p>
        </div>
        <span className={nextClientAction.badgeClassName}>{nextClientAction.status}</span>
        <Link
          className="admin-text-action"
          href={nextClientAction.href}
          onClick={nextClientAction.calendarCreateIntent ? onCalendarCreateIntent : undefined}
        >
          {nextClientAction.ctaLabel}
        </Link>
      </section>

      <section className="admin-client-section admin-client-work-profile" aria-label="Рабочий профиль клиента">
        <div className="admin-client-section-head">
          <h3>Рабочий профиль</h3>
          <span className={statusClass(client.status)}>{client.status}</span>
        </div>
        <div className="admin-client-work-grid">
          <article>
            <span>Последний завершенный визит</span>
            <strong>{lastCompletedVisit?.date ?? "Нет завершенных визитов"}</strong>
            <small>{lastCompletedVisit?.service ?? "История пока пустая"}</small>
          </article>
          <article>
            <span>Ближайшая запись</span>
            <strong>{nextAppointment ? appointmentVisitLabel(nextAppointment) : "Не назначена"}</strong>
            <small>{nextAppointment?.service ?? "Можно записать клиента вручную"}</small>
          </article>
          <article>
            <span>Активный сертификат</span>
            <strong>{activeCertificate ? `${activeCertificate.code} · ${activeCertificate.amount}` : "Нет активного сертификата"}</strong>
            <small>{activeCertificate?.status ?? "Можно выдать сертификат из карточки"}</small>
          </article>
        </div>
        <p className="admin-client-work-note">
          <strong>Заметка к работе</strong>
          {client.note || "Заметка пока пустая."}
        </p>
        <div className="admin-client-next-actions">
          {nextAppointment ? (
            <Link className="admin-client-inline-link" href={calendarAppointmentHref(nextAppointment, role, client.id)}>
              Открыть ближайшую запись
            </Link>
          ) : null}
          {activeCertificate ? (
            <Link className="admin-client-inline-link" href={certificateDetailHref(activeCertificate.code, role)}>
              Открыть активный сертификат
            </Link>
          ) : null}
          <Link className="admin-client-inline-link" href={calendarCreateHref(client.id, role)} onClick={onCalendarCreateIntent}>
            Записать снова
          </Link>
          <Link className="admin-client-inline-link" href={calendarClientHref(client.id, role)}>
            Все записи клиента
          </Link>
          <Link className="admin-client-inline-link" href={certificateClientHref(client.id, role)}>
            Все сертификаты клиента
          </Link>
        </div>
      </section>

      <section className="admin-client-section admin-client-activity-feed" aria-label="Рабочая лента клиента">
        <div className="admin-client-section-head">
          <h3>Рабочая лента</h3>
          <div className="admin-client-feed-filters" aria-label="Фильтры рабочей ленты клиента">
            {clientFeedFilterOptions.map((filter) => (
              <button
                aria-pressed={activeFeedFilter === filter.id}
                key={filter.id}
                onClick={() => setActiveFeedFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {hasVisibleFeedItems ? (
          <ol className="admin-client-feed-list">
            {shouldShowVisits
              ? client.history.map((visit) => {
                  const linkedAppointment = findClientVisitAppointment(visit, appointments);

                  return (
                    <li key={`feed-visit-${visit.date}-${visit.service}`}>
                      <span className="admin-feed-type">Визит</span>
                      <div>
                        <strong>{visit.service}</strong>
                        <span>{visit.date}</span>
                      </div>
                      <span className={statusClass(visit.status)}>{visit.status}</span>
                      {linkedAppointment ? (
                        <Link
                          aria-label={`Открыть запись ${visit.date}`}
                          className="admin-client-inline-link"
                          href={calendarAppointmentHref(linkedAppointment, role, client.id)}
                        >
                          Открыть запись
                        </Link>
                      ) : null}
                    </li>
                  );
                })
              : null}
            {shouldShowCertificates
              ? certificates.map((certificate) => (
                  <li key={`feed-certificate-${certificate.code}`}>
                    <span className="admin-feed-type">Сертификат</span>
                    <div>
                      <strong>{certificate.code}</strong>
                      <span>
                        {certificate.buyer} → {certificate.recipient} · {certificate.amount}
                      </span>
                    </div>
                    <span className={statusClass(certificate.status)}>{certificate.status}</span>
                    <Link
                      aria-label={`Открыть сертификат ${certificate.code}`}
                      className="admin-client-inline-link"
                      href={certificateDetailHref(certificate.code, role)}
                    >
                      Открыть сертификат
                    </Link>
                  </li>
                ))
              : null}
            {shouldShowNotes && client.note ? (
              <li>
                <span className="admin-feed-type">Заметка</span>
                <div>
                  <strong>Рабочая заметка</strong>
                  <span>{client.note}</span>
                </div>
                <span className={statusClass(client.status)}>{client.status}</span>
                <button className="admin-client-inline-button" onClick={startNoteEdit} type="button">
                  Редактировать
                </button>
              </li>
            ) : null}
          </ol>
        ) : (
          <p>В этом фильтре пока нет записей.</p>
        )}
      </section>

      <section className="admin-client-section admin-client-next-appointment" aria-label="Ближайшая запись клиента">
        <div className="admin-client-section-head">
          <h3>Ближайшая запись</h3>
          {nextAppointment ? <span className={statusClass(nextAppointment.status)}>{nextAppointment.status}</span> : null}
        </div>
        {nextAppointment ? (
          <div className="admin-client-next-card">
            <div>
              <strong>{nextAppointment.service}</strong>
              <span>{appointmentVisitLabel(nextAppointment)}</span>
            </div>
            <p>{nextAppointment.note || "Комментарий к записи пока пуст."}</p>
            <div className="admin-client-next-actions">
          <Link className="admin-client-inline-link" href={calendarAppointmentHref(nextAppointment, role, client.id)}>
                Открыть запись
              </Link>
            </div>
          </div>
        ) : (
          <p>В календаре пока нет записи для этого клиента.</p>
        )}
      </section>

      <section className="admin-client-section">
        <h3>История визитов</h3>
        <ol className="admin-client-history">
          {client.history.map((visit) => {
                  const linkedAppointment = findClientVisitAppointment(visit, appointments);

            return (
              <li key={`${visit.date}-${visit.service}`}>
                <div>
                  <strong>{visit.service}</strong>
                  <span>{visit.date}</span>
                </div>
                <span className="admin-client-history-actions">
                  <span className={statusClass(visit.status)}>{visit.status}</span>
                  {linkedAppointment ? (
                    <Link
                      aria-label={`Открыть запись ${visit.date}`}
                      className="admin-client-inline-link"
                      href={calendarAppointmentHref(linkedAppointment, role, client.id)}
                    >
                      Открыть запись
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="admin-client-section">
        <h3>Сертификаты</h3>
        {certificates.length > 0 ? (
          <ul className="admin-client-certificates">
            {certificates.map((certificate) => (
              <li key={certificate.code}>
                <div>
                  <Link className="admin-client-certificate-code" href={certificateDetailHref(certificate.code, role)}>
                    {certificate.code}
                  </Link>
                  <span>
                    {certificate.buyer} → {certificate.recipient}
                  </span>
                </div>
                <div>
                  <strong>{certificate.amount}</strong>
                  <span className={statusClass(certificate.status)}>{certificate.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Сертификатов пока нет.</p>
        )}
      </section>

      <section className="admin-client-section">
        <div className="admin-client-section-head">
          <h3>Заметки</h3>
          {isEditingNote ? null : (
            <button className="admin-outline-action" onClick={startNoteEdit} type="button">
              Редактировать заметку
            </button>
          )}
        </div>
        {isEditingNote ? (
          <form className="admin-client-note-form" onSubmit={handleNoteSubmit}>
            <label htmlFor="admin-client-note-editor">Заметка клиента</label>
            <textarea
              id="admin-client-note-editor"
              onChange={(event) => setDraftNote(event.target.value)}
              rows={5}
              value={draftNote}
            />
            <div className="admin-client-note-actions">
              <button className="admin-text-action" type="submit">
                Сохранить заметку
              </button>
              <button className="admin-outline-action" onClick={cancelNoteEdit} type="button">
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <p>{client.note || "Заметка пока пустая."}</p>
        )}
        {saveNotice ? (
          <p className="admin-client-save-notice" role="status">
            {saveNotice}
          </p>
        ) : null}
        <div className="admin-client-tags" aria-label="Теги клиента">
          {client.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}

function ClientsWorkspace({
  appointments,
  certificates,
  clients,
  isClientCreateOpen,
  onCalendarCreateIntent,
  onCloseClientCreate,
  onSaveCertificate,
  onSaveClient,
  onSaveClientNote,
  query,
  role,
  selectedClientName,
}: {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  isClientCreateOpen: boolean;
  onCalendarCreateIntent: () => void;
  onCloseClientCreate: () => void;
  onSaveCertificate: (certificate: CertificateRecord, originalCode?: string) => void;
  onSaveClient: (client: ClientRecord, originalClientIdentity?: string) => void;
  onSaveClientNote: (clientIdentity: string, note: string) => void;
  query: string;
  role: AdminRoleId;
  selectedClientName?: string;
}) {
  const initialSelectedClientKey = findClientByIdentity(clients, selectedClientName)?.id ?? clients[0]?.id ?? "";
  const [selectedClientKey, setSelectedClientKey] = useState(initialSelectedClientKey);
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState(Boolean(selectedClientName));
  const [editingClient, setEditingClient] = useState<ClientRecord | undefined>();
  const [certificateDraft, setCertificateDraft] = useState<CertificateRecord | undefined>();
  const [clientFilter, setClientFilter] = useState<ClientFilterId>("all");
  const filteredClients = clients.filter(
    (client) =>
      matchesClientFilter(client, clientFilter) &&
      matchesSearch(
        [
          client.name,
          client.phone,
          client.email,
          client.language,
          client.visits,
          client.next,
          client.status,
          client.preferredContact,
          client.note,
        ],
        query,
      ),
  );
  const selectedClient = findClientByIdentity(clients, selectedClientKey) ?? filteredClients[0] ?? clients[0];
  const selectedClientAppointments = findClientAppointments(appointments, selectedClient, clients);
  const selectedClientCertificates = findClientCertificates(certificates, selectedClient, clients);
  const isClientFormOpen = isClientCreateOpen || Boolean(editingClient);

  function openClient(clientKey: string) {
    setSelectedClientKey(clientKey);
    setIsClientDrawerOpen(true);
  }

  function openClientEdit(client: ClientRecord) {
    onCloseClientCreate();
    setCertificateDraft(undefined);
    setEditingClient(client);
  }

  function closeClientForm() {
    setEditingClient(undefined);
    onCloseClientCreate();
  }

  function openClientCertificateDraft(client: ClientRecord) {
    onCloseClientCreate();
    setEditingClient(undefined);
    setCertificateDraft(buildClientCertificateDraft(client, certificates));
  }

  function closeClientCertificateDraft() {
    setCertificateDraft(undefined);
  }

  function saveClientCertificate(certificate: CertificateRecord, originalCode?: string) {
    onSaveCertificate(certificate, originalCode);
    setCertificateDraft(undefined);
  }

  function saveClientForm(client: ClientRecord, originalClientIdentity?: string) {
    onSaveClient(client, originalClientIdentity);
    setSelectedClientKey(client.id);
    setIsClientDrawerOpen(true);
    closeClientForm();
  }

  if (!selectedClient) {
    return <EmptyState label="Клиенты не найдены." />;
  }

  return (
    <div className="admin-split-view admin-clients-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="clients-heading">
        <div className="admin-panel-head">
          <h2 id="clients-heading">Клиентская база</h2>
          <div className="admin-filter-row" aria-label="Фильтры клиентов">
            {clientFilterOptions.map((filter) => (
              <button
                aria-pressed={clientFilter === filter.id}
                key={filter.id}
                onClick={() => setClientFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="admin-filter-help admin-client-filter-help" aria-label="Смысл фильтра активных клиентов">
            <strong>Активные — это клиенты со статусом &quot;Активный клиент&quot; и минимум 5 визитами.</strong>
            <span>Причина активности показывается в таблице, мобильной карточке и карточке клиента.</span>
          </div>
        </div>
        <div className="admin-table-scroll admin-clients-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Язык</th>
                <th>Визиты</th>
                <th>Статус</th>
                <th>Активность</th>
                <th>Следующий визит</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const activity = clientActivitySummary(client);

                return (
                  <tr aria-selected={client.id === selectedClient.id} key={client.id}>
                    <td>
                      <Link
                        className="admin-row-action admin-row-link"
                        href={clientProfileHref(client.id, role)}
                        onClick={() => openClient(client.id)}
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="admin-tabular">{client.phone}</td>
                    <td>{client.language.toUpperCase()}</td>
                    <td className="admin-tabular">{client.visits}</td>
                    <td>
                      <span className={statusClass(client.status)}>{client.status}</span>
                    </td>
                    <td>
                      <span className="admin-client-activity-reason">{activity.reason}</span>
                      <small>{activity.nextVisit}</small>
                    </td>
                    <td>{client.next}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul aria-label="Мобильный список клиентов" className="admin-mobile-client-list">
          {filteredClients.map((client) => {
            const activity = clientActivitySummary(client);

            return (
              <li key={client.id}>
                <Link
                  aria-current={client.id === selectedClient.id ? "page" : undefined}
                  className="admin-mobile-client-card"
                  href={clientProfileHref(client.id, role)}
                  onClick={() => openClient(client.id)}
                >
                  <span className="admin-mobile-client-head">
                    <strong>{client.name}</strong>
                    <span>{client.language.toUpperCase()}</span>
                  </span>
                  <span className="admin-mobile-client-meta">
                    <span className="admin-tabular">{client.phone}</span>
                    <span>{visitCountLabel(client.visits)}</span>
                  </span>
                  <span className="admin-mobile-client-activity">{activity.reason}</span>
                  <span className="admin-mobile-client-foot">
                    <span className={statusClass(client.status)}>{client.status}</span>
                    <span>{client.next}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {filteredClients.length === 0 ? <EmptyState label="Клиенты не найдены." /> : null}
      </section>

      {isClientDrawerOpen ? (
        <div className="admin-drawer-backdrop">
          <ClientDetailCard
            appointments={selectedClientAppointments}
            certificates={selectedClientCertificates}
            key={selectedClient.id}
            client={selectedClient}
            onCalendarCreateIntent={onCalendarCreateIntent}
            onClose={() => setIsClientDrawerOpen(false)}
            onEditClient={openClientEdit}
            onIssueCertificate={openClientCertificateDraft}
            onSaveNote={onSaveClientNote}
            role={role}
          />
        </div>
      ) : null}
      {isClientFormOpen ? (
          <ClientFormDialog
            clients={clients}
            initialClient={editingClient}
            key={editingClient?.id ?? "new-client"}
            onClose={closeClientForm}
            onSave={saveClientForm}
            role={role}
        />
      ) : null}
      {certificateDraft ? (
        <CertificateFormDialog
          initialCertificate={certificateDraft}
          isCreatePrefill
          key={certificateDraft.code}
          onClose={closeClientCertificateDraft}
          onSave={saveClientCertificate}
        />
      ) : null}
    </div>
  );
}

function AppointmentDetailDrawer({
  appointment,
  appointmentClient,
  onCancelAppointment,
  onClose,
  onEditAppointment,
  role,
}: {
  appointment: Appointment;
  appointmentClient?: ClientRecord;
  onCancelAppointment: (appointment: Appointment) => void;
  onClose: () => void;
  onEditAppointment: (appointment: Appointment) => void;
  role: AdminRoleId;
}) {
  return (
    <aside
      aria-label="Детали выбранной записи"
      aria-modal="true"
      className="admin-panel admin-detail-panel admin-drawer-panel admin-appointment-drawer"
      role="dialog"
    >
      <div className="admin-panel-head">
        <span className="admin-kicker">Детали записи</span>
        <button className="admin-icon-button" onClick={onClose} type="button">
          Закрыть
        </button>
      </div>
      <div className="admin-detail-heading">
        <h2>{appointment.client}</h2>
        <div className="admin-detail-actions">
          {appointmentClient ? (
            <Link className="admin-outline-action" href={clientProfileHref(appointmentClient.id, role)}>
              Открыть клиента
            </Link>
          ) : null}
          <button className="admin-text-action" onClick={() => onEditAppointment(appointment)} type="button">
            Редактировать
          </button>
          {appointment.status === "Отменена" ? null : (
            <button className="admin-danger-button" onClick={() => onCancelAppointment(appointment)} type="button">
              Отменить
            </button>
          )}
        </div>
      </div>
      <dl className="admin-detail-list">
        <div>
          <dt>Дата</dt>
          <dd>{formatCalendarDay(appointment.date)}</dd>
        </div>
        <div>
          <dt>Услуга</dt>
          <dd>{appointment.service}</dd>
        </div>
        <div>
          <dt>Статус</dt>
          <dd>
            <span className={statusClass(appointment.status)}>{appointment.status}</span>
          </dd>
        </div>
        <div>
          <dt>Время</dt>
          <dd>{appointment.time}</dd>
        </div>
        <div>
          <dt>Комментарий</dt>
          <dd>{appointment.note || "Комментарий к записи пока пуст."}</dd>
        </div>
      </dl>
      {appointmentClient ? (
        <section className="admin-client-section admin-linked-client-actions" aria-label="Связанные действия клиента">
          <div className="admin-client-section-head">
            <h3>Связанные действия</h3>
            <span className={statusClass(appointmentClient.status)}>{appointmentClient.status}</span>
          </div>
          <p>Быстрые переходы к клиентской работе по этой записи.</p>
          <div className="admin-client-next-actions">
            <Link className="admin-client-inline-link" href={clientProfileHref(appointmentClient.id, role)}>
              Карточка клиента
            </Link>
            <Link className="admin-client-inline-link" href={calendarClientHref(appointmentClient.id, role)}>
              Все записи клиента
            </Link>
            <Link className="admin-client-inline-link" href={certificateClientHref(appointmentClient.id, role)}>
              Все сертификаты клиента
            </Link>
            <Link className="admin-client-inline-link" href={calendarCreateHref(appointmentClient.id, role)}>
              Записать снова
            </Link>
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function AdminDetailDrawer({
  ariaLabel,
  children,
  className = "",
  kicker,
  onClose,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  kicker: string;
  onClose: () => void;
}) {
  const drawerClassName = ["admin-panel", "admin-detail-panel", "admin-drawer-panel", className].filter(Boolean).join(" ");

  return (
    <div className="admin-drawer-backdrop">
      <aside aria-label={ariaLabel} aria-modal="true" className={drawerClassName} role="dialog">
        <div className="admin-panel-head">
          <span className="admin-kicker">{kicker}</span>
          <button className="admin-icon-button" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function CertificatesWorkspace({
  certificates,
  clients,
  isCertificateCreateOpen,
  onCloseCertificateCreate,
  onSaveCertificate,
  onUpdateCertificateStatus,
  query,
  role,
  selectedCertificateCode,
  selectedClientName,
}: {
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  isCertificateCreateOpen: boolean;
  onCloseCertificateCreate: () => void;
  onSaveCertificate: (certificate: CertificateRecord, originalCode?: string) => void;
  onUpdateCertificateStatus: (certificateCode: string, status: CertificateStatus, historyEntry: string) => void;
  query: string;
  role: AdminRoleId;
  selectedCertificateCode?: string;
  selectedClientName?: string;
}) {
  const selectedClientFilter = findClientByIdentity(clients, selectedClientName);
  const selectedClientFilterName = selectedClientFilter?.name;
  const clientScopedCertificates = selectedClientFilterName
    ? certificates.filter((certificate) => certificateBelongsToClient(certificate, selectedClientFilter, clients))
    : certificates;
  const [selectedCode, setSelectedCode] = useState(() => {
    if (selectedCertificateCode && certificates.some((certificate) => certificate.code === selectedCertificateCode)) {
      return selectedCertificateCode;
    }

    return clientScopedCertificates[0]?.code ?? certificates[0]?.code ?? "";
  });
  const [isCertificateDrawerOpen, setIsCertificateDrawerOpen] = useState(Boolean(selectedCertificateCode));
  const [editingCertificate, setEditingCertificate] = useState<CertificateRecord | undefined>();
  const [actionNotice, setActionNotice] = useState("");
  const filteredCertificates = clientScopedCertificates.filter((certificate) =>
    matchesSearch(
      [
        certificate.code,
        certificate.buyer,
        certificate.clientName,
        certificate.recipient,
        certificate.amount,
        certificate.status,
        certificate.stripeId,
        certificate.note,
      ],
      query,
    ),
  );
  const selectedCertificate =
    filteredCertificates.find((certificate) => certificate.code === selectedCode) ??
    certificates.find((certificate) => certificate.code === selectedCode) ??
    filteredCertificates[0] ??
    certificates[0];
  const linkedClient = selectedCertificate ? findCertificateClient(clients, selectedCertificate) : undefined;
  const isCertificateFormOpen = isCertificateCreateOpen || Boolean(editingCertificate);
  const paidCount = clientScopedCertificates.filter((certificate) => certificate.status === "Оплачено").length;
  const pendingPdfCount = clientScopedCertificates.filter((certificate) => certificate.status === "Ожидает PDF").length;
  const redeemedCount = clientScopedCertificates.filter((certificate) => certificate.status === "Погашен").length;

  function openCertificate(code: string) {
    setSelectedCode(code);
    setActionNotice("");
    setIsCertificateDrawerOpen(true);
  }

  function openCertificateEdit(certificate: CertificateRecord) {
    onCloseCertificateCreate();
    setActionNotice("");
    setEditingCertificate(certificate);
  }

  function closeCertificateForm() {
    setEditingCertificate(undefined);
    onCloseCertificateCreate();
  }

  function saveCertificateForm(certificate: CertificateRecord, originalCode?: string) {
    onSaveCertificate(certificate, originalCode);
    setSelectedCode(certificate.code);
    setIsCertificateDrawerOpen(true);
    setActionNotice(originalCode ? "Сертификат обновлен." : "Сертификат создан.");
    closeCertificateForm();
  }

  function setCertificateStatus(status: CertificateStatus, notice: string) {
    if (!selectedCertificate) {
      return;
    }

    onUpdateCertificateStatus(selectedCertificate.code, status, `2026-07-07: ${notice}`);
    setSelectedCode(selectedCertificate.code);
    setActionNotice(notice);
  }

  if (!selectedCertificate) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="certificates-heading">
        <div className="admin-panel-head">
          <h2 id="certificates-heading">Сертификаты</h2>
        </div>
        <EmptyState label="Сертификаты пока не заведены." />
        {isCertificateFormOpen ? (
          <CertificateFormDialog
            initialCertificate={editingCertificate}
            key={editingCertificate?.code ?? "new-certificate"}
            onClose={closeCertificateForm}
            onSave={saveCertificateForm}
          />
        ) : null}
      </section>
    );
  }

  return (
    <div className="admin-split-view admin-certificates-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="certificates-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="certificates-heading">Сертификаты</h2>
            <p>Ручная выдача, PDF-статус, погашение и связь с клиентской карточкой.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры сертификатов">
            <button aria-pressed="true" type="button">
              Все
            </button>
            <button type="button">К отправке</button>
            <button type="button">Погашены</button>
          </div>
        </div>
        {selectedClientFilterName ? (
          <div className="admin-route-context" aria-label="Фильтр сертификатов по клиенту">
            <div>
              <strong>Показаны сертификаты клиента {selectedClientFilterName}</strong>
              <span>Таблица, статусы PDF и погашение ограничены сертификатами этой клиентской карточки.</span>
            </div>
            <div className="admin-route-context-actions">
              <Link className="admin-client-inline-link" href={clientProfileHref(selectedClientFilter.id, role)}>
                Открыть карточку клиента
              </Link>
              <Link className="admin-client-inline-link" href={adminSectionHref("certificates", role)}>
                Сбросить фильтр
              </Link>
            </div>
          </div>
        ) : null}

        <div className="admin-metric-row admin-certificate-summary" aria-label="Сводка сертификатов">
          <article className="admin-metric admin-metric-success">
            <span>Оплачено</span>
            <strong>{paidCount}</strong>
          </article>
          <article className="admin-metric admin-metric-warning">
            <span>PDF ждут</span>
            <strong>{pendingPdfCount}</strong>
          </article>
          <article className="admin-metric admin-metric-neutral">
            <span>Погашено</span>
            <strong>{redeemedCount}</strong>
          </article>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Код</th>
                <th>Покупатель</th>
                <th>Клиент</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Оплата</th>
              </tr>
            </thead>
            <tbody>
              {filteredCertificates.map((certificate) => (
                <tr aria-selected={isCertificateDrawerOpen && certificate.code === selectedCertificate.code} key={certificate.code}>
                  <td>
                    <Link
                      className="admin-row-action admin-row-link"
                      href={certificateDetailHref(certificate.code, role)}
                      onClick={() => openCertificate(certificate.code)}
                    >
                      {certificate.code}
                    </Link>
                  </td>
                  <td>{certificate.buyer}</td>
                  <td>{certificate.clientName}</td>
                  <td className="admin-tabular">{certificate.amount}</td>
                  <td>
                    <span className={statusClass(certificate.status)}>{certificate.status}</span>
                  </td>
                  <td className="admin-tabular">{certificate.paymentDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredCertificates.length === 0 ? <EmptyState label="Сертификаты не найдены." /> : null}
      </section>

      {isCertificateDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали сертификата" kicker="Сертификат" onClose={() => setIsCertificateDrawerOpen(false)}>
        <div className="admin-detail-heading">
          <h2>{selectedCertificate.code}</h2>
          <div className="admin-detail-actions">
            {linkedClient ? (
              <Link className="admin-outline-action" href={clientProfileHref(linkedClient.id, role)}>
                Открыть клиента
              </Link>
            ) : null}
            <button className="admin-text-action" onClick={() => openCertificateEdit(selectedCertificate)} type="button">
              Редактировать
            </button>
            <button
              className="admin-text-action"
              disabled={selectedCertificate.status === "Отправлен" || selectedCertificate.status === "Погашен"}
              onClick={() => setCertificateStatus("Отправлен", "PDF отмечен как отправленный.")}
              type="button"
            >
              Отправить PDF
            </button>
            <button
              className="admin-danger-button"
              disabled={selectedCertificate.status === "Погашен"}
              onClick={() => setCertificateStatus("Погашен", "Сертификат погашен.")}
              type="button"
            >
              Погасить
            </button>
          </div>
        </div>

        {actionNotice ? (
          <p className="admin-export-notice" role="status">
            {actionNotice}
          </p>
        ) : null}

        <dl className="admin-detail-list">
          <div>
            <dt>Покупатель → получатель</dt>
            <dd>
              {selectedCertificate.buyer} → {selectedCertificate.recipient}
            </dd>
          </div>
          <div>
            <dt>Клиент</dt>
            <dd>{selectedCertificate.clientName}</dd>
          </div>
          <div>
            <dt>Сумма</dt>
            <dd>{selectedCertificate.amount}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={statusClass(selectedCertificate.status)}>{selectedCertificate.status}</span>
            </dd>
          </div>
          <div>
            <dt>Stripe ID</dt>
            <dd>{selectedCertificate.stripeId}</dd>
          </div>
          <div>
            <dt>Дата оплаты</dt>
            <dd>{selectedCertificate.paymentDate}</dd>
          </div>
          <div>
            <dt>Действителен до</dt>
            <dd>{selectedCertificate.expiresAt}</dd>
          </div>
          <div>
            <dt>Заметка</dt>
            <dd>{selectedCertificate.note || "Заметка по сертификату пока пустая."}</dd>
          </div>
        </dl>

        {linkedClient ? (
          <section className="admin-client-section admin-linked-client-actions" aria-label="Связанные действия клиента">
            <div className="admin-client-section-head">
              <h3>Связанные действия</h3>
              <span className={statusClass(linkedClient.status)}>{linkedClient.status}</span>
            </div>
            <p>Быстрые переходы к клиентской работе по этому сертификату.</p>
            <div className="admin-client-next-actions">
              <Link className="admin-client-inline-link" href={clientProfileHref(linkedClient.id, role)}>
                Карточка клиента
              </Link>
              <Link className="admin-client-inline-link" href={calendarClientHref(linkedClient.id, role)}>
                Все записи клиента
              </Link>
              <Link className="admin-client-inline-link" href={certificateClientHref(linkedClient.id, role)}>
                Все сертификаты клиента
              </Link>
              <Link className="admin-client-inline-link" href={calendarCreateHref(linkedClient.id, role)}>
                Записать клиента
              </Link>
            </div>
          </section>
        ) : null}

        <section className="admin-client-section">
          <h3>История</h3>
          <ul className="admin-client-history">
            {selectedCertificate.history.map((entry) => (
              <li key={entry}>
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </section>
        </AdminDetailDrawer>
      ) : null}

      {isCertificateFormOpen ? (
        <CertificateFormDialog
          initialCertificate={editingCertificate}
          key={editingCertificate?.code ?? "new-certificate"}
          onClose={closeCertificateForm}
          onSave={saveCertificateForm}
        />
      ) : null}
    </div>
  );
}

function ServicesWorkspace({
  isServiceCreateOpen,
  onCloseServiceCreate,
  onSaveService,
  prices,
  query,
  role,
  selectedServiceSlug,
  services,
}: {
  isServiceCreateOpen: boolean;
  onCloseServiceCreate: () => void;
  onSaveService: (service: ServiceRecord, originalSlug?: string) => void;
  prices: PriceRecord[];
  query: string;
  role: AdminRoleId;
  selectedServiceSlug?: string;
  services: ServiceRecord[];
}) {
  const initialSelectedService = selectedServiceSlug ? findServiceBySlug(services, selectedServiceSlug) : undefined;
  const [selectedSlug, setSelectedSlug] = useState(initialSelectedService?.slug ?? services[0]?.slug ?? "");
  const [isServiceDrawerOpen, setIsServiceDrawerOpen] = useState(Boolean(initialSelectedService));
  const [editingService, setEditingService] = useState<ServiceRecord | undefined>();
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceStatus>("all");
  const filteredServices = services
    .filter((service) => statusFilter === "all" || service.status === statusFilter)
    .filter((service) =>
      matchesSearch(
        [service.name, service.slug, service.category, service.duration, service.status, service.seoTitle, service.summary],
        query,
      ),
    )
    .sort((first, second) => first.order - second.order);
  const selectedService =
    filteredServices.find((service) => service.slug === selectedSlug) ??
    filteredServices[0] ??
    services.find((service) => service.slug === selectedSlug) ??
    services[0];
  const servicePriceRows = selectedService
    ? prices.filter((price) => normalizeSearch(price.serviceSlug) === normalizeSearch(selectedService.slug))
    : [];
  const isServiceFormOpen = isServiceCreateOpen || Boolean(editingService);

  function openService(service: ServiceRecord) {
    setSelectedSlug(service.slug);
    setIsServiceDrawerOpen(true);
  }

  function openServiceEdit(service: ServiceRecord) {
    onCloseServiceCreate();
    setEditingService(service);
  }

  function closeServiceForm() {
    setEditingService(undefined);
    onCloseServiceCreate();
  }

  function saveServiceForm(service: ServiceRecord, originalSlug?: string) {
    onSaveService(service, originalSlug);
    setSelectedSlug(service.slug);
    setIsServiceDrawerOpen(true);
    closeServiceForm();
  }

  if (!selectedService) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="services-heading">
        <div className="admin-panel-head">
          <h2 id="services-heading">Виды массажа</h2>
        </div>
        <EmptyState label="Услуги пока не заведены." />
        {isServiceFormOpen ? (
          <ServiceFormDialog
            initialService={editingService}
            key={editingService?.slug ?? "new-service"}
            onClose={closeServiceForm}
            onSave={saveServiceForm}
          />
        ) : null}
      </section>
    );
  }

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="services-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="services-heading">Каталог услуг</h2>
            <p>Название, slug, SEO, локали, обложка и видимость услуги на сайте.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры услуг">
            <button aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")} type="button">
              Все
            </button>
            <button aria-pressed={statusFilter === "Опубликована"} onClick={() => setStatusFilter("Опубликована")} type="button">
              Опубликованы
            </button>
            <button aria-pressed={statusFilter === "Черновик"} onClick={() => setStatusFilter("Черновик")} type="button">
              Черновики
            </button>
            <button aria-pressed={statusFilter === "Скрыта"} onClick={() => setStatusFilter("Скрыта")} type="button">
              Скрытые
            </button>
          </div>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Slug</th>
                <th>Категория</th>
                <th>Длительность</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service) => (
                <tr aria-selected={isServiceDrawerOpen && service.slug === selectedService.slug} key={service.slug}>
                  <td>
                    <Link className="admin-row-action admin-row-link" href={serviceDetailHref(service.slug, role)} onClick={() => openService(service)}>
                      {service.name}
                    </Link>
                  </td>
                  <td className="admin-tabular">{service.slug}</td>
                  <td>{service.category}</td>
                  <td>{service.duration}</td>
                  <td>
                    <span className={statusClass(service.status)}>{service.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredServices.length === 0 ? <EmptyState label="Услуги не найдены." /> : null}
      </section>

      {isServiceDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали услуги" kicker="Услуга" onClose={() => setIsServiceDrawerOpen(false)}>
        <div className="admin-detail-heading">
          <h2>{selectedService.name}</h2>
          <div className="admin-detail-actions">
            <button className="admin-text-action" onClick={() => openServiceEdit(selectedService)} type="button">
              Редактировать
            </button>
          </div>
        </div>
        <dl className="admin-detail-list">
          <div>
            <dt>Slug</dt>
            <dd>{selectedService.slug}</dd>
          </div>
          <div>
            <dt>Описание</dt>
            <dd>{selectedService.summary || "Описание пока пустое."}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={statusClass(selectedService.status)}>{selectedService.status}</span>
            </dd>
          </div>
          <div>
            <dt>Категория</dt>
            <dd>{selectedService.category}</dd>
          </div>
          <div>
            <dt>Длительность</dt>
            <dd>{selectedService.duration}</dd>
          </div>
          <div>
            <dt>SEO title</dt>
            <dd>{selectedService.seoTitle}</dd>
          </div>
          <div>
            <dt>Обложка</dt>
            <dd>{selectedService.coverImage || "Не выбрана"}</dd>
          </div>
          <div>
            <dt>Локали</dt>
            <dd>{selectedService.locales.join(", ")}</dd>
          </div>
        </dl>

        <section className="admin-client-section">
          <h3>Варианты цены</h3>
          {servicePriceRows.length > 0 ? (
            <ul className="admin-client-history">
              {servicePriceRows.map((price) => (
                <li key={price.id}>
                  <span>{price.durationMinutes} мин</span>
                  <strong>{priceValue(price)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Для этой услуги пока нет цены.</p>
          )}
        </section>
        </AdminDetailDrawer>
      ) : null}

      {isServiceFormOpen ? (
        <ServiceFormDialog
          initialService={editingService}
          key={editingService?.slug ?? "new-service"}
          onClose={closeServiceForm}
          onSave={saveServiceForm}
        />
      ) : null}
    </div>
  );
}

function PriceWorkspace({
  isPriceCreateOpen,
  onClosePriceCreate,
  onSavePrice,
  prices,
  query,
  role,
  selectedPriceId,
  services,
}: {
  isPriceCreateOpen: boolean;
  onClosePriceCreate: () => void;
  onSavePrice: (price: PriceRecord, originalId?: string) => void;
  prices: PriceRecord[];
  query: string;
  role: AdminRoleId;
  selectedPriceId?: string;
  services: ServiceRecord[];
}) {
  const initialSelectedPrice = selectedPriceId ? prices.find((price) => price.id === selectedPriceId) : undefined;
  const [selectedId, setSelectedId] = useState(initialSelectedPrice?.id ?? prices[0]?.id ?? "");
  const [isPriceDrawerOpen, setIsPriceDrawerOpen] = useState(Boolean(initialSelectedPrice));
  const [editingPrice, setEditingPrice] = useState<PriceRecord | undefined>();
  const [statusFilter, setStatusFilter] = useState<"all" | PriceStatus>("all");
  const filteredPrices = prices
    .filter((price) => statusFilter === "all" || price.status === statusFilter)
    .filter((price) => {
      const service = findServiceBySlug(services, price.serviceSlug);

      return matchesSearch(
        [priceLabel(price, services), service?.category, price.durationMinutes, price.priceEur, price.status, price.updatedAt, price.note],
        query,
      );
    })
    .sort((first, second) => first.order - second.order);
  const selectedPrice =
    filteredPrices.find((price) => price.id === selectedId) ??
    filteredPrices[0] ??
    prices.find((price) => price.id === selectedId) ??
    prices[0];
  const selectedService = selectedPrice ? findServiceBySlug(services, selectedPrice.serviceSlug) : undefined;
  const isPriceFormOpen = isPriceCreateOpen || Boolean(editingPrice);

  function openPrice(price: PriceRecord) {
    setSelectedId(price.id);
    setIsPriceDrawerOpen(true);
  }

  function openPriceEdit(price: PriceRecord) {
    onClosePriceCreate();
    setEditingPrice(price);
  }

  function closePriceForm() {
    setEditingPrice(undefined);
    onClosePriceCreate();
  }

  function savePriceForm(price: PriceRecord, originalId?: string) {
    onSavePrice(price, originalId);
    setSelectedId(price.id);
    setIsPriceDrawerOpen(true);
    closePriceForm();
  }

  if (!selectedPrice) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="price-heading">
        <div className="admin-panel-head">
          <h2 id="price-heading">Прайс</h2>
        </div>
        <EmptyState label="Цены пока не заведены." />
        {isPriceFormOpen ? (
          <PriceFormDialog
            initialPrice={editingPrice}
            key={editingPrice?.id ?? "new-price"}
            onClose={closePriceForm}
            onSave={savePriceForm}
            services={services}
          />
        ) : null}
      </section>
    );
  }

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="price-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="price-heading">Прайс</h2>
            <p>Варианты услуги, длительность, цена в евро, активность и порядок вывода.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры прайса">
            <button aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")} type="button">
              Все
            </button>
            <button aria-pressed={statusFilter === "Активна"} onClick={() => setStatusFilter("Активна")} type="button">
              Активные
            </button>
            <button aria-pressed={statusFilter === "Скрыта"} onClick={() => setStatusFilter("Скрыта")} type="button">
              Скрытые
            </button>
          </div>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Длительность</th>
                <th>Цена</th>
                <th>Статус</th>
                <th>Порядок</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrices.map((price) => (
                <tr aria-selected={isPriceDrawerOpen && price.id === selectedPrice.id} key={price.id}>
                  <td>
                    <Link className="admin-row-action admin-row-link" href={priceDetailHref(price.id, role)} onClick={() => openPrice(price)}>
                      {priceLabel(price, services)}
                    </Link>
                  </td>
                  <td className="admin-tabular">{price.durationMinutes} мин</td>
                  <td className="admin-tabular">{priceValue(price)}</td>
                  <td>
                    <span className={statusClass(price.status)}>{price.status}</span>
                  </td>
                  <td className="admin-tabular">{price.order}</td>
                  <td className="admin-tabular">{price.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPrices.length === 0 ? <EmptyState label="Цены не найдены." /> : null}
      </section>

      {isPriceDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали цены" kicker="Цена" onClose={() => setIsPriceDrawerOpen(false)}>
        <div className="admin-detail-heading">
          <h2>{priceLabel(selectedPrice, services)}</h2>
          <div className="admin-detail-actions">
            <button className="admin-text-action" onClick={() => openPriceEdit(selectedPrice)} type="button">
              Редактировать
            </button>
          </div>
        </div>
        <dl className="admin-detail-list">
          <div>
            <dt>Услуга</dt>
            <dd>{selectedService?.name ?? selectedPrice.serviceSlug}</dd>
          </div>
          <div>
            <dt>Категория</dt>
            <dd>{selectedService?.category ?? "Не указана"}</dd>
          </div>
          <div>
            <dt>Цена</dt>
            <dd>{priceValue(selectedPrice)}</dd>
          </div>
          <div>
            <dt>Длительность</dt>
            <dd>{selectedPrice.durationMinutes} мин</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={statusClass(selectedPrice.status)}>{selectedPrice.status}</span>
            </dd>
          </div>
          <div>
            <dt>Порядок</dt>
            <dd>{selectedPrice.order}</dd>
          </div>
          <div>
            <dt>Валюта</dt>
            <dd>EUR</dd>
          </div>
          <div>
            <dt>Заметка</dt>
            <dd>{selectedPrice.note || "Заметка по цене пока пустая."}</dd>
          </div>
        </dl>
        </AdminDetailDrawer>
      ) : null}

      {isPriceFormOpen ? (
        <PriceFormDialog
          initialPrice={editingPrice}
          key={editingPrice?.id ?? "new-price"}
          onClose={closePriceForm}
          onSave={savePriceForm}
          services={services}
        />
      ) : null}
    </div>
  );
}

function CalendarWorkspace({
  appointments,
  bookingBufferMinutes,
  clients,
  dailySlotCapacity,
  onCancelAppointment,
  onCalendarDateChange,
  onEditAppointment,
  query,
  role,
  selectedAppointmentFocus,
  selectedCalendarDate,
  selectedClientName,
}: {
  appointments: Appointment[];
  bookingBufferMinutes: number;
  clients: ClientRecord[];
  dailySlotCapacity: number;
  onCancelAppointment: (appointment: Appointment) => void;
  onCalendarDateChange: (date: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
  query: string;
  role: AdminRoleId;
  selectedAppointmentFocus?: CalendarAppointmentFocus;
  selectedCalendarDate?: string;
  selectedClientName?: string;
}) {
  const selectedClientFilter = findClientByIdentity(clients, selectedClientName);
  const selectedClientFilterName = selectedClientFilter?.name;
  const clientScopedAppointments = selectedClientFilterName
    ? appointments.filter((appointment) => appointmentBelongsToClient(appointment, selectedClientFilter, clients))
    : appointments;
  const fallbackAppointment = appointments[0] ?? {
    client: "Нет записи",
    date: "2026-07-06",
    note: "",
    service: "Не выбрано",
    status: "Новая заявка" as const,
    time: "00:00",
  };
  const filteredAppointments = clientScopedAppointments.filter((appointment) =>
    matchesSearch([appointment.date, appointment.time, appointment.client, appointment.service, appointment.status, appointment.note], query),
  );
  const initialSelectedDate =
    selectedAppointmentFocus?.date ??
    (isCalendarMonthDate(selectedCalendarDate) ? selectedCalendarDate : (sortAppointments(filteredAppointments)[0]?.date ?? "2026-07-06"));
  const initialSelectedAppointment = selectedAppointmentFocus
    ? filteredAppointments.find((appointment) => appointmentKey(appointment) === selectedAppointmentFocus.appointmentKey)
    : isCalendarMonthDate(selectedCalendarDate)
      ? filteredAppointments.find((appointment) => appointment.date === initialSelectedDate)
      : filteredAppointments[0];
  const [mode, setMode] = useState<CalendarMode>("day");
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [isAppointmentDrawerOpen, setIsAppointmentDrawerOpen] = useState(Boolean(selectedAppointmentFocus));
  const [selectedKey, setSelectedKey] = useState(
    () => selectedAppointmentFocus?.appointmentKey ?? appointmentKey(initialSelectedAppointment ?? fallbackAppointment),
  );
  const selectedDayAppointments = sortAppointments(filteredAppointments.filter((appointment) => appointment.date === selectedDate));
  const listAppointments = sortAppointments(filteredAppointments);
  const visibleAppointments = mode === "day" ? selectedDayAppointments : listAppointments;
  const appointmentDetailPool = mode === "day" ? selectedDayAppointments : listAppointments;
  const hasVisibleAppointments = visibleAppointments.length > 0;
  const selectedAppointment =
    hasVisibleAppointments
      ? (appointmentDetailPool.find((appointment) => appointmentKey(appointment) === selectedKey) ??
        appointmentDetailPool[0] ??
        fallbackAppointment)
      : fallbackAppointment;
  const selectedAppointmentKey = hasVisibleAppointments ? appointmentKey(selectedAppointment) : "";
  const calendarHeading = calendarHeadingLabel(mode, selectedDate);
  const selectedAppointmentClient = findAppointmentClient(clients, selectedAppointment);
  const shouldShowAppointmentDrawer = isAppointmentDrawerOpen && mode !== "month" && hasVisibleAppointments;
  const weekDays = calendarMonthDays.slice(5, 12);
  const selectedDayFreeCount = freeSlotCount(selectedDayAppointments.length, dailySlotCapacity);
  const confirmedListCount = listAppointments.filter((appointment) => appointment.status === "Подтверждена").length;
  const attentionListCount = listAppointments.filter((appointment) => appointment.status !== "Подтверждена" && appointment.status !== "Отменена").length;

  function switchMode(nextMode: CalendarMode) {
    setMode(nextMode);
    setIsAppointmentDrawerOpen(false);
  }

  function selectAppointment(appointment: Appointment) {
    onCalendarDateChange(appointment.date);
    setSelectedDate(appointment.date);
    setSelectedKey(appointmentKey(appointment));
    setIsAppointmentDrawerOpen(true);
  }

  function selectDate(date: string, appointments: Appointment[], nextMode: CalendarMode = mode) {
    onCalendarDateChange(date);
    setSelectedDate(date);
    setMode(nextMode);
    setIsAppointmentDrawerOpen(false);

    if (appointments[0]) {
      setSelectedKey(appointmentKey(appointments[0]));
    } else {
      setSelectedKey("");
    }
  }

  return (
    <div className="admin-split-view admin-calendar-workspace">
      <section className="admin-panel admin-calendar-panel" aria-labelledby="calendar-heading">
        <div className="admin-panel-head">
          <h2 id="calendar-heading">{calendarHeading}</h2>
          <div className="admin-filter-row" aria-label="Режимы календаря">
            {calendarModes.map((calendarMode) => (
              <button
                aria-pressed={mode === calendarMode.id}
                key={calendarMode.id}
                onClick={() => switchMode(calendarMode.id)}
                type="button"
              >
                {calendarMode.label}
              </button>
            ))}
          </div>
        </div>
        {selectedClientFilterName ? (
          <div className="admin-route-context" aria-label="Фильтр календаря по клиенту">
            <div>
              <strong>Показаны записи клиента {selectedClientFilterName}</strong>
              <span>Календарь открыт на ближайшей записи клиента, список и месяц тоже считаются только по нему.</span>
            </div>
            <div className="admin-route-context-actions">
              <Link className="admin-client-inline-link" href={clientProfileHref(selectedClientFilter.id, role)}>
                Открыть карточку клиента
              </Link>
              <Link className="admin-client-inline-link" href={adminSectionHref("calendar", role)}>
                Сбросить фильтр
              </Link>
            </div>
          </div>
        ) : null}

        {mode === "month" ? (
          <>
            <div className="admin-calendar-month-grid" role="grid" aria-label={`Месяц ${calendarMonthLabel}`}>
              {calendarWeekdayLabels.map((weekday) => (
                <span className="admin-calendar-weekday" key={weekday} role="columnheader">
                  {weekday}
                </span>
              ))}
              {Array.from({ length: calendarLeadingBlankDays }, (_, index) => (
                <span aria-hidden="true" className="admin-calendar-month-cell admin-calendar-month-cell-empty" key={`blank-${index}`} role="gridcell" />
              ))}
              {calendarMonthDays.map((day) => {
                const dayAppointments = filteredAppointments.filter((appointment) => appointment.date === day.date);
                const countLabel = appointmentCountLabel(dayAppointments.length);
                const freeCount = freeSlotCount(dayAppointments.length, dailySlotCapacity);
                const freeLabel = freeSlotLabel(freeCount);
                const compactCountLabel = compactAppointmentCountLabel(dayAppointments.length);
                const compactFreeLabel = compactFreeSlotLabel(freeCount);

                return (
                  <span className="admin-calendar-month-cell" key={day.date} role="gridcell">
                    <button
                      aria-label={`${day.day} июля, ${countLabel}, ${freeLabel}`}
                      aria-pressed={selectedDate === day.date}
                      className="admin-calendar-day-button"
                      onClick={() => selectDate(day.date, dayAppointments, "day")}
                      type="button"
                    >
                      <strong>{day.day}</strong>
                      <small>
                        <span className="admin-month-count-full">{countLabel}</span>
                        <span className="admin-month-count-compact">{compactCountLabel}</span>
                        <span className="admin-month-free-full">{freeLabel}</span>
                        <span className="admin-month-free-compact">{compactFreeLabel}</span>
                      </small>
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="admin-calendar-context-note" aria-label="План месяца">
              <div>
                <span className="admin-kicker">План месяца</span>
                <p>
                  В ячейках месяца показаны только количество записей и свободные слоты. Нажатие на день открывает дневной режим.
                </p>
              </div>
              <dl className="admin-detail-list">
                <div>
                  <dt>Расчет слотов</dt>
                  <dd>{slotCountLabel(dailySlotCapacity)} в день</dd>
                </div>
                <div>
                  <dt>Буфер между сеансами</dt>
                  <dd>{bookingBufferMinutes} минут, Настройки → Запись</dd>
                </div>
              </dl>
            </div>
          </>
        ) : mode === "week" ? (
          <div className="admin-calendar-week-grid" role="grid" aria-label={calendarWeekLabel}>
            {weekDays.map((day) => {
              const dayAppointments = filteredAppointments.filter((appointment) => appointment.date === day.date);
              const countLabel = appointmentCountLabel(dayAppointments.length);
              const freeCount = freeSlotCount(dayAppointments.length, dailySlotCapacity);
              const freeLabel = freeSlotLabel(freeCount);
              const compactCountLabel = compactAppointmentCountLabel(dayAppointments.length);
              const compactFreeLabel = compactFreeSlotLabel(freeCount);

              return (
                <section className="admin-calendar-week-day" key={day.date} role="gridcell">
                  <button
                    aria-label={`${formatCalendarShortDay(day.date)}, ${countLabel}, ${freeLabel}`}
                    className="admin-week-day-head"
                    onClick={() => selectDate(day.date, dayAppointments, "day")}
                    type="button"
                  >
                    <strong className="admin-week-day-date">{formatCalendarShortDay(day.date)}</strong>
                    <span className="admin-week-day-stats">
                      <span>{compactCountLabel}</span>
                      <span>{compactFreeLabel}</span>
                    </span>
                  </button>
                  <div className="admin-week-appointment-list">
                    {dayAppointments.length > 0 ? (
                      dayAppointments.map((appointment) => {
                        const key = appointmentKey(appointment);

                        return (
                          <button
                            aria-pressed={key === selectedAppointmentKey}
                            className="admin-week-appointment"
                            key={key}
                            onClick={() => selectAppointment(appointment)}
                            type="button"
                          >
                            <span className="admin-week-appointment-main">
                              <time className="admin-tabular">{appointment.time}</time>
                              <strong>{appointment.client}</strong>
                            </span>
                            <span className="admin-week-appointment-service">{appointment.service}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="admin-week-empty">Свободно</span>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : mode === "day" ? (
          <>
            <div className="admin-day-summary" aria-label={`Сводка дня ${formatCalendarDay(selectedDate)}`}>
              <div className="admin-day-summary-card">
                <span>Записи</span>
                <strong>{appointmentCountLabel(selectedDayAppointments.length)}</strong>
              </div>
              <div className="admin-day-summary-card">
                <span>Свободно</span>
                <strong>{freeSlotLabel(selectedDayFreeCount)}</strong>
              </div>
              <div className="admin-day-summary-card">
                <span>Буфер</span>
                <strong>{bookingBufferMinutes} минут</strong>
              </div>
            </div>
            <div className="admin-day-timeline" aria-label="Таймлайн дня" role="list">
              {selectedDayAppointments.map((appointment) => {
                const key = appointmentKey(appointment);

                return (
                  <div className="admin-day-timeline-row" key={key} role="listitem">
                    <div className="admin-day-time-rail">
                      <time className="admin-tabular">{appointment.time}</time>
                      <span>Буфер после сеанса: {bookingBufferMinutes} минут</span>
                    </div>
                    <button
                      aria-pressed={key === selectedAppointmentKey}
                      className="admin-day-appointment-card"
                      onClick={() => selectAppointment(appointment)}
                      type="button"
                    >
                      <span className="admin-day-appointment-head">
                        <strong>{appointment.client}</strong>
                        <span className={statusClass(appointment.status)}>{appointment.status}</span>
                      </span>
                      <span className="admin-day-appointment-service">{appointment.service}</span>
                      {appointment.note ? <span className="admin-day-appointment-note">{appointment.note}</span> : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="admin-appointment-summary" aria-label="Сводка списка записей">
              <div className="admin-appointment-summary-card">
                <span>Всего записей</span>
                <strong>{listAppointments.length}</strong>
              </div>
              <div className="admin-appointment-summary-card">
                <span>Подтверждены</span>
                <strong>{confirmedListCount}</strong>
              </div>
              <div className="admin-appointment-summary-card">
                <span>Требуют внимания</span>
                <strong>{attentionListCount}</strong>
              </div>
            </div>
            <div className="admin-appointment-feed" aria-label="Лента всех записей">
              {listAppointments.map((appointment) => {
                const key = appointmentKey(appointment);

                return (
                  <button
                    aria-pressed={key === selectedAppointmentKey}
                    className="admin-calendar-item admin-appointment-feed-item"
                    key={key}
                    onClick={() => selectAppointment(appointment)}
                    type="button"
                  >
                    <time className="admin-tabular">{appointment.time}</time>
                    <span className="admin-appointment-feed-main">
                      <strong>{appointment.client}</strong>
                      <small>
                        {formatCalendarDay(appointment.date)} · {appointment.service}
                      </small>
                      {appointment.note ? <small>{appointment.note}</small> : null}
                    </span>
                    <span className={statusClass(appointment.status)}>{appointment.status}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {mode !== "month" && mode !== "week" && visibleAppointments.length === 0 ? <EmptyState label="Записи не найдены." /> : null}
      </section>

      {shouldShowAppointmentDrawer ? (
        <div className="admin-drawer-backdrop">
          <AppointmentDetailDrawer
            appointment={selectedAppointment}
            appointmentClient={selectedAppointmentClient}
            onCancelAppointment={onCancelAppointment}
            onClose={() => setIsAppointmentDrawerOpen(false)}
            onEditAppointment={onEditAppointment}
            role={role}
          />
        </div>
      ) : null}
    </div>
  );
}

function FinanceWorkspace({ query }: { query: string }) {
  const [exportNotice, setExportNotice] = useState("");
  const [periodStart, setPeriodStart] = useState("2026-07-01");
  const [periodEnd, setPeriodEnd] = useState("2026-07-03");
  const filteredFinanceRows = useMemo(
    () =>
      financeRows.filter((row) =>
        matchesDatePeriod(row.date, periodStart, periodEnd) &&
        matchesSearch([row.date, row.id, row.certificateCode, row.buyer, row.status, row.gross, row.refund], query),
      ),
    [periodEnd, periodStart, query],
  );
  const currentSummary = useMemo(() => calculateFinanceSummary(filteredFinanceRows), [filteredFinanceRows]);
  const financePeriod = formatFinancePeriod(periodStart, periodEnd);

  function handleExport(format: "CSV" | "XLSX" | "PDF") {
    if (format === "CSV") {
      downloadCsv("magic-massage-stripe-sales.csv", buildFinanceCsv(filteredFinanceRows));
    }

    setExportNotice(`${format} отчет за ${financePeriod} готов к скачиванию.`);
  }

  return (
    <section className="admin-panel admin-panel-large" aria-labelledby="finance-heading">
      <div className="admin-panel-head admin-panel-head-finance">
        <div>
          <h2 id="finance-heading">Stripe-продажи за период</h2>
          <p>Период считается по timezone бизнеса Europe/Sofia.</p>
        </div>
        <div className="admin-export-actions" aria-label="Форматы выгрузки">
          <button onClick={() => handleExport("CSV")} type="button">
            CSV
          </button>
          <button onClick={() => handleExport("XLSX")} type="button">
            XLSX
          </button>
          <button onClick={() => handleExport("PDF")} type="button">
            PDF
          </button>
        </div>
      </div>

      <div className="admin-finance-period" aria-label="Период продаж Stripe">
        <label>
          <span>С</span>
          <input
            aria-label="Начало периода"
            onChange={(event) => setPeriodStart(event.target.value)}
            type="date"
            value={periodStart}
          />
        </label>
        <label>
          <span>По</span>
          <input
            aria-label="Конец периода"
            onChange={(event) => setPeriodEnd(event.target.value)}
            type="date"
            value={periodEnd}
          />
        </label>
        <p>
          Показано <strong>{paymentCountLabel(currentSummary.payments)}</strong> за <strong>{financePeriod}</strong>.
        </p>
      </div>

      {exportNotice ? (
        <p className="admin-export-notice" role="status">
          {exportNotice}
        </p>
      ) : null}

      <div className="admin-finance-summary" aria-label="Finance summary">
        <article>
          <span>Gross</span>
          <strong>{formatCurrency(currentSummary.gross)}</strong>
        </article>
        <article>
          <span>Refunds</span>
          <strong>{formatCurrency(currentSummary.refunds)}</strong>
        </article>
        <article>
          <span>Stripe fees</span>
          <strong>{formatCurrency(currentSummary.stripeFees)}</strong>
        </article>
        <article>
          <span>Net</span>
          <strong>{formatCurrency(currentSummary.net)}</strong>
        </article>
        <article>
          <span>Payments</span>
          <strong>{currentSummary.payments}</strong>
        </article>
      </div>

      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Платеж</th>
              <th>Сертификат</th>
              <th>Покупатель</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Refund</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredFinanceRows.map((row) => (
              <tr key={row.id}>
                <td className="admin-tabular">{row.date}</td>
                <td className="admin-tabular">{row.id}</td>
                <td>{row.certificateCode}</td>
                <td>{row.buyer}</td>
                <td className="admin-tabular">{formatCurrency(row.gross)}</td>
                <td className="admin-tabular">{formatCurrency(row.stripeFee)}</td>
                <td className="admin-tabular">{formatCurrency(row.refund)}</td>
                <td className="admin-tabular">{formatCurrency(row.gross - row.refund - row.stripeFee)}</td>
                <td>
                  <span className={statusClass(row.status ?? "Оплачено")}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredFinanceRows.length === 0 ? <EmptyState label="Платежи не найдены." /> : null}

      <div className="admin-finance-footer">
        <span>Последняя выгрузка: 2026-07-03 18:20</span>
        <span>
          Следующая выгрузка будет записана в <strong>audit log</strong>
        </span>
      </div>
    </section>
  );
}

function MediaWorkspace({
  isMediaCreateOpen,
  media,
  onCloseMediaCreate,
  onSaveMedia,
  query,
  role,
  selectedMediaId,
}: {
  isMediaCreateOpen: boolean;
  media: MediaRecord[];
  onCloseMediaCreate: () => void;
  onSaveMedia: (media: MediaRecord, originalId?: string) => void;
  query: string;
  role: AdminRoleId;
  selectedMediaId?: string;
}) {
  const initialSelectedMedia = selectedMediaId ? media.find((item) => item.id === selectedMediaId) : undefined;
  const [selectedId, setSelectedId] = useState(initialSelectedMedia?.id ?? media[0]?.id ?? "");
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState(Boolean(initialSelectedMedia));
  const [editingMedia, setEditingMedia] = useState<MediaRecord | undefined>();
  const [filter, setFilter] = useState<"all" | "photo" | "documents" | "needsAlt">("all");
  const filteredMedia = media
    .filter((item) => {
      if (filter === "photo") {
        return item.type === "Фото";
      }

      if (filter === "documents") {
        return item.type === "Документ";
      }

      if (filter === "needsAlt") {
        return item.status === "Требует alt";
      }

      return true;
    })
    .filter((item) =>
      matchesSearch(
        [item.name, item.url, item.folder, item.type, item.status, item.altText, item.size, item.dimensions, item.usage.join(" ")],
        query,
      ),
    )
    .sort((first, second) => first.name.localeCompare(second.name, "ru-RU"));
  const selectedMedia =
    filteredMedia.find((item) => item.id === selectedId) ??
    filteredMedia[0] ??
    media.find((item) => item.id === selectedId) ??
    media[0];
  const isMediaFormOpen = isMediaCreateOpen || Boolean(editingMedia);

  function openMedia(item: MediaRecord) {
    setSelectedId(item.id);
    setIsMediaDrawerOpen(true);
  }

  function openMediaEdit(item: MediaRecord) {
    onCloseMediaCreate();
    setEditingMedia(item);
  }

  function closeMediaForm() {
    setEditingMedia(undefined);
    onCloseMediaCreate();
  }

  function saveMediaForm(item: MediaRecord, originalId?: string) {
    onSaveMedia(item, originalId);
    setSelectedId(item.id);
    setIsMediaDrawerOpen(true);
    closeMediaForm();
  }

  if (!selectedMedia) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="media-heading">
        <div className="admin-panel-head">
          <h2 id="media-heading">Медиа</h2>
        </div>
        <EmptyState label="Медиа пока не добавлены." />
        {isMediaFormOpen ? (
          <MediaFormDialog
            initialMedia={editingMedia}
            key={editingMedia?.id ?? "new-media"}
            onClose={closeMediaForm}
            onSave={saveMediaForm}
          />
        ) : null}
      </section>
    );
  }

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="media-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="media-heading">Библиотека медиа</h2>
            <p>Файлы сайта, папки, alt-тексты, статус готовности и места использования.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры медиа">
            <button aria-pressed={filter === "all"} onClick={() => setFilter("all")} type="button">
              Все
            </button>
            <button aria-pressed={filter === "photo"} onClick={() => setFilter("photo")} type="button">
              Фото
            </button>
            <button aria-pressed={filter === "documents"} onClick={() => setFilter("documents")} type="button">
              Документы
            </button>
            <button aria-pressed={filter === "needsAlt"} onClick={() => setFilter("needsAlt")} type="button">
              Требует alt
            </button>
          </div>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Файл</th>
                <th>Папка</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Использование</th>
              </tr>
            </thead>
            <tbody>
              {filteredMedia.map((item) => (
                <tr aria-selected={isMediaDrawerOpen && item.id === selectedMedia.id} key={item.id}>
                  <td>
                    <Link className="admin-row-action admin-row-link" href={mediaDetailHref(item.id, role)} onClick={() => openMedia(item)}>
                      {item.name}
                    </Link>
                  </td>
                  <td>{item.folder}</td>
                  <td>{item.type}</td>
                  <td>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </td>
                  <td>{item.usage[0] ?? "Не используется"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMedia.length === 0 ? <EmptyState label="Медиа не найдены." /> : null}
      </section>

      {isMediaDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали медиа" kicker="Медиа" onClose={() => setIsMediaDrawerOpen(false)}>
        <div className="admin-detail-heading">
          <h2>{selectedMedia.name}</h2>
          <div className="admin-detail-actions">
            <button className="admin-text-action" onClick={() => openMediaEdit(selectedMedia)} type="button">
              Редактировать
            </button>
          </div>
        </div>

        <div className="admin-media-preview">
          {selectedMedia.type === "Фото" ? (
            <Image
              alt={selectedMedia.altText || selectedMedia.name}
              fill
              key={selectedMedia.url}
              priority
              sizes="340px"
              src={selectedMedia.url}
              unoptimized
            />
          ) : null}
          <span>{selectedMedia.type}</span>
        </div>

        <dl className="admin-detail-list">
          <div>
            <dt>URL</dt>
            <dd>{selectedMedia.url}</dd>
          </div>
          <div>
            <dt>Alt-текст</dt>
            <dd>{selectedMedia.altText || "Alt-текст нужно заполнить перед публикацией."}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={statusClass(selectedMedia.status)}>{selectedMedia.status}</span>
            </dd>
          </div>
          <div>
            <dt>Папка</dt>
            <dd>{selectedMedia.folder}</dd>
          </div>
          <div>
            <dt>Размер</dt>
            <dd>{selectedMedia.size || "Не указан"}</dd>
          </div>
          <div>
            <dt>Разрешение</dt>
            <dd>{selectedMedia.dimensions || "Не указано"}</dd>
          </div>
          <div>
            <dt>Загружено</dt>
            <dd>{selectedMedia.uploadedAt}</dd>
          </div>
        </dl>

        <section className="admin-client-section">
          <h3>Использование</h3>
          {selectedMedia.usage.length > 0 ? (
            <ul className="admin-client-history">
              {selectedMedia.usage.map((usage) => (
                <li key={usage}>
                  <span>{usage}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Файл пока не привязан к страницам.</p>
          )}
        </section>
        </AdminDetailDrawer>
      ) : null}

      {isMediaFormOpen ? (
        <MediaFormDialog
          initialMedia={editingMedia}
          key={editingMedia?.id ?? "new-media"}
          onClose={closeMediaForm}
          onSave={saveMediaForm}
        />
      ) : null}
    </div>
  );
}

function ContactsWorkspace({
  contactChannels,
  contactSettings,
  isContactSettingsOpen,
  onCloseContactSettings,
  onSaveContactChannel,
  onSaveContactSettings,
  query,
  role,
  selectedContactId,
}: {
  contactChannels: ContactChannelRecord[];
  contactSettings: ContactSettingsRecord;
  isContactSettingsOpen: boolean;
  onCloseContactSettings: () => void;
  onSaveContactChannel: (channel: ContactChannelRecord, originalId?: string) => void;
  onSaveContactSettings: (settings: ContactSettingsRecord) => void;
  query: string;
  role: AdminRoleId;
  selectedContactId?: string;
}) {
  const initialSelectedContact = selectedContactId ? contactChannels.find((channel) => channel.id === selectedContactId) : undefined;
  const [selectedId, setSelectedId] = useState(initialSelectedContact?.id ?? contactChannels[0]?.id ?? "");
  const [isContactDrawerOpen, setIsContactDrawerOpen] = useState(Boolean(initialSelectedContact));
  const [editingChannel, setEditingChannel] = useState<ContactChannelRecord | undefined>();
  const [filter, setFilter] = useState<"all" | "active" | "messengers" | "seo">("all");
  const filteredChannels = contactChannels
    .filter((channel) => {
      if (filter === "active") {
        return channel.status === "Активен";
      }

      if (filter === "messengers") {
        return channel.type === "Мессенджер";
      }

      if (filter === "seo") {
        return channel.type === "Карта" || channel.usage.some((usage) => normalizeSearch(usage).includes("seo"));
      }

      return true;
    })
    .filter((channel) =>
      matchesSearch([channel.name, channel.type, channel.status, channel.value, channel.note, channel.usage.join(" ")], query),
    )
    .sort((first, second) => first.name.localeCompare(second.name, "ru-RU"));
  const selectedChannel =
    filteredChannels.find((channel) => channel.id === selectedId) ??
    filteredChannels[0] ??
    contactChannels.find((channel) => channel.id === selectedId) ??
    contactChannels[0];

  function openChannel(channel: ContactChannelRecord) {
    setSelectedId(channel.id);
    setIsContactDrawerOpen(true);
  }

  function openChannelEdit(channel: ContactChannelRecord) {
    onCloseContactSettings();
    setEditingChannel(channel);
  }

  function closeChannelForm() {
    setEditingChannel(undefined);
  }

  function saveChannelForm(channel: ContactChannelRecord, originalId?: string) {
    onSaveContactChannel(channel, originalId);
    setSelectedId(channel.id);
    setIsContactDrawerOpen(true);
    closeChannelForm();
  }

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="contacts-workspace-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="contacts-workspace-heading">Контактные настройки сайта</h2>
            <p>Публичные данные салона, каналы связи, карта, Studio24 и LocalBusiness SEO для сайта.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры контактов">
            <button aria-pressed={filter === "all"} onClick={() => setFilter("all")} type="button">
              Все
            </button>
            <button aria-pressed={filter === "active"} onClick={() => setFilter("active")} type="button">
              Активные
            </button>
            <button aria-pressed={filter === "messengers"} onClick={() => setFilter("messengers")} type="button">
              Мессенджеры
            </button>
            <button aria-pressed={filter === "seo"} onClick={() => setFilter("seo")} type="button">
              SEO/карта
            </button>
          </div>
        </div>

        <dl className="admin-detail-list" aria-label="Контактные настройки">
          <div>
            <dt>Название</dt>
            <dd>{contactSettings.businessName}</dd>
          </div>
          <div>
            <dt>Телефон</dt>
            <dd>{contactSettings.phone}</dd>
          </div>
          <div>
            <dt>Адрес</dt>
            <dd>{contactSettings.address}</dd>
          </div>
          <div>
            <dt>Часы работы</dt>
            <dd>{contactSettings.workingHours}</dd>
          </div>
        </dl>

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Канал</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Значение</th>
                <th>Использование</th>
              </tr>
            </thead>
            <tbody>
              {filteredChannels.map((channel) => (
                <tr aria-selected={isContactDrawerOpen && channel.id === selectedChannel?.id} key={channel.id}>
                  <td>
                    <Link className="admin-row-action admin-row-link" href={contactDetailHref(channel.id, role)} onClick={() => openChannel(channel)}>
                      {channel.name}
                    </Link>
                  </td>
                  <td>{channel.type}</td>
                  <td>
                    <span className={statusClass(channel.status)}>{channel.status}</span>
                  </td>
                  <td>{channel.value}</td>
                  <td>{channel.usage[0] ?? "Не используется"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredChannels.length === 0 ? <EmptyState label="Контакты не найдены." /> : null}
      </section>

      {isContactDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали контакта" kicker="Контакт" onClose={() => setIsContactDrawerOpen(false)}>
        {selectedChannel ? (
          <>
            <div className="admin-detail-heading">
              <h2>{selectedChannel.name}</h2>
              <div className="admin-detail-actions">
                <button className="admin-text-action" onClick={() => openChannelEdit(selectedChannel)} type="button">
                  Редактировать
                </button>
              </div>
            </div>

            <dl className="admin-detail-list">
              <div>
                <dt>Тип</dt>
                <dd>{selectedChannel.type}</dd>
              </div>
              <div>
                <dt>Статус</dt>
                <dd>
                  <span className={statusClass(selectedChannel.status)}>{selectedChannel.status}</span>
                </dd>
              </div>
              <div>
                <dt>Значение</dt>
                <dd>{selectedChannel.value}</dd>
              </div>
              <div>
                <dt>Заметка</dt>
                <dd>{selectedChannel.note || "Заметка не добавлена."}</dd>
              </div>
            </dl>

            <section className="admin-client-section">
              <h3>Использование</h3>
              {selectedChannel.usage.length > 0 ? (
                <ul className="admin-client-history">
                  {selectedChannel.usage.map((usage) => (
                    <li key={usage}>
                      <span>{usage}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Канал пока не привязан к публичным блокам сайта.</p>
              )}
            </section>
          </>
        ) : (
          <EmptyState label="Выберите контактный канал." />
        )}
        </AdminDetailDrawer>
      ) : null}

      {isContactSettingsOpen ? (
        <ContactSettingsDialog
          key={`${contactSettings.phone}-${contactSettings.address}`}
          onClose={onCloseContactSettings}
          onSave={onSaveContactSettings}
          settings={contactSettings}
        />
      ) : null}

      {editingChannel ? (
        <ContactChannelDialog
          initialChannel={editingChannel}
          key={editingChannel.id}
          onClose={closeChannelForm}
          onSave={saveChannelForm}
        />
      ) : null}
    </div>
  );
}

function BlogWorkspace({
  blogPosts,
  isBlogCreateOpen,
  onCloseBlogCreate,
  onSaveBlogPost,
  query,
  role,
  selectedBlogPostId,
}: {
  blogPosts: BlogPostRecord[];
  isBlogCreateOpen: boolean;
  onCloseBlogCreate: () => void;
  onSaveBlogPost: (post: BlogPostRecord, originalId?: string) => void;
  query: string;
  role: AdminRoleId;
  selectedBlogPostId?: string;
}) {
  const initialSelectedBlogPost = selectedBlogPostId ? blogPosts.find((post) => post.id === selectedBlogPostId) : undefined;
  const [selectedId, setSelectedId] = useState(initialSelectedBlogPost?.id ?? blogPosts[0]?.id ?? "");
  const [isBlogDrawerOpen, setIsBlogDrawerOpen] = useState(Boolean(initialSelectedBlogPost));
  const [editingPost, setEditingPost] = useState<BlogPostRecord | undefined>();
  const [statusFilter, setStatusFilter] = useState<"all" | BlogStatus>("all");
  const filteredPosts = blogPosts
    .filter((post) => statusFilter === "all" || post.status === statusFilter)
    .filter((post) =>
      matchesSearch(
        [
          post.title,
          post.slug,
          post.category,
          post.status,
          post.author,
          post.seoTitle,
          post.excerpt,
          post.body,
          post.tags.join(" "),
          post.locales.join(" "),
        ],
        query,
      ),
    )
    .sort((first, second) => first.publishedAt.localeCompare(second.publishedAt));
  const selectedPost =
    filteredPosts.find((post) => post.id === selectedId) ??
    filteredPosts[0] ??
    blogPosts.find((post) => post.id === selectedId) ??
    blogPosts[0];
  const isBlogFormOpen = isBlogCreateOpen || Boolean(editingPost);

  function openPost(post: BlogPostRecord) {
    setSelectedId(post.id);
    setIsBlogDrawerOpen(true);
  }

  function openPostEdit(post: BlogPostRecord) {
    onCloseBlogCreate();
    setEditingPost(post);
  }

  function closeBlogForm() {
    setEditingPost(undefined);
    onCloseBlogCreate();
  }

  function savePostForm(post: BlogPostRecord, originalId?: string) {
    onSaveBlogPost(post, originalId);
    setSelectedId(post.id);
    setIsBlogDrawerOpen(true);
    closeBlogForm();
  }

  if (!selectedPost) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="blog-heading">
        <div className="admin-panel-head">
          <h2 id="blog-heading">Контент-план блога</h2>
        </div>
        <EmptyState label="Статьи пока не заведены." />
        {isBlogFormOpen ? (
          <BlogPostDialog
            initialPost={editingPost}
            key={editingPost?.id ?? "new-blog-post"}
            onClose={closeBlogForm}
            onSave={savePostForm}
          />
        ) : null}
      </section>
    );
  }

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="blog-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="blog-heading">Контент-план блога</h2>
            <p>Статьи сайта, категории, теги, SEO, локали, обложки и статус публикации.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры блога">
            <button aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")} type="button">
              Все
            </button>
            <button aria-pressed={statusFilter === "Опубликована"} onClick={() => setStatusFilter("Опубликована")} type="button">
              Опубликованные
            </button>
            <button aria-pressed={statusFilter === "Черновик"} onClick={() => setStatusFilter("Черновик")} type="button">
              Черновики
            </button>
            <button aria-pressed={statusFilter === "Запланирована"} onClick={() => setStatusFilter("Запланирована")} type="button">
              Запланированные
            </button>
          </div>
        </div>

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Статья</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Локали</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post) => (
                <tr aria-selected={isBlogDrawerOpen && post.id === selectedPost.id} key={post.id}>
                  <td>
                    <Link className="admin-row-action admin-row-link" href={blogDetailHref(post.id, role)} onClick={() => openPost(post)}>
                      {post.title}
                    </Link>
                  </td>
                  <td>{post.category}</td>
                  <td>
                    <span className={statusClass(post.status)}>{post.status}</span>
                  </td>
                  <td className="admin-tabular">{post.publishedAt}</td>
                  <td>{post.locales.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPosts.length === 0 ? <EmptyState label="Статьи не найдены." /> : null}
      </section>

      {isBlogDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали статьи" kicker="Статья" onClose={() => setIsBlogDrawerOpen(false)}>
        <div className="admin-detail-heading">
          <h2>{selectedPost.title}</h2>
          <div className="admin-detail-actions">
            <button className="admin-text-action" onClick={() => openPostEdit(selectedPost)} type="button">
              Редактировать
            </button>
          </div>
        </div>

        <dl className="admin-detail-list">
          <div>
            <dt>Slug</dt>
            <dd>{selectedPost.slug}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={statusClass(selectedPost.status)}>{selectedPost.status}</span>
            </dd>
          </div>
          <div>
            <dt>Категория</dt>
            <dd>{selectedPost.category}</dd>
          </div>
          <div>
            <dt>Автор</dt>
            <dd>{selectedPost.author}</dd>
          </div>
          <div>
            <dt>Дата публикации</dt>
            <dd>{selectedPost.publishedAt}</dd>
          </div>
          <div>
            <dt>Обновлено</dt>
            <dd>{selectedPost.updatedAt}</dd>
          </div>
          <div>
            <dt>Локали</dt>
            <dd>{selectedPost.locales.join(", ")}</dd>
          </div>
          <div>
            <dt>SEO title</dt>
            <dd>{selectedPost.seoTitle}</dd>
          </div>
          <div>
            <dt>Обложка</dt>
            <dd>{selectedPost.coverImage || "Обложка не выбрана."}</dd>
          </div>
          <div>
            <dt>Краткое описание</dt>
            <dd>{selectedPost.excerpt || "Описание пока пустое."}</dd>
          </div>
        </dl>

        <section className="admin-client-section">
          <h3>Теги</h3>
          {selectedPost.tags.length > 0 ? (
            <ul className="admin-client-history">
              {selectedPost.tags.map((tag) => (
                <li key={tag}>
                  <span>{tag}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Теги пока не добавлены.</p>
          )}
        </section>

        <section className="admin-client-section">
          <h3>Текст статьи</h3>
          <p>{selectedPost.body || "Текст статьи пока пустой."}</p>
        </section>
        </AdminDetailDrawer>
      ) : null}

      {isBlogFormOpen ? (
        <BlogPostDialog
          initialPost={editingPost}
          key={editingPost?.id ?? "new-blog-post"}
          onClose={closeBlogForm}
          onSave={savePostForm}
        />
      ) : null}
    </div>
  );
}

function SettingsWorkspace({
  isSettingsEditOpen,
  onCloseSettingsEdit,
  onOpenSettingsEdit,
  onSaveSettings,
  query,
  role,
  selectedSettingsGroupId,
  settings,
}: {
  isSettingsEditOpen: boolean;
  onCloseSettingsEdit: () => void;
  onOpenSettingsEdit: () => void;
  onSaveSettings: (settings: SettingsRecord) => void;
  query: string;
  role: AdminRoleId;
  selectedSettingsGroupId?: string;
  settings: SettingsRecord;
}) {
  const initialSelectedSettingsGroup = selectedSettingsGroupId
    ? settingsGroups.find((group) => group.id === selectedSettingsGroupId)
    : undefined;
  const [selectedGroupId, setSelectedGroupId] = useState<SettingsGroupId>(initialSelectedSettingsGroup?.id ?? "booking");
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(Boolean(initialSelectedSettingsGroup));
  const [actionNotice, setActionNotice] = useState("");
  const [isDangerDialogOpen, setIsDangerDialogOpen] = useState(false);
  const filteredGroups = settingsGroups.filter((group) => matchesSearch([group.title, group.summary, group.status], query));
  const selectedGroup = filteredGroups.find((group) => group.id === selectedGroupId) ?? filteredGroups[0];

  function openGroup(groupId: SettingsGroupId) {
    setSelectedGroupId(groupId);
    setIsSettingsDrawerOpen(true);
    setActionNotice("");
  }

  function saveSettingsForm(nextSettings: SettingsRecord) {
    onSaveSettings(nextSettings);
    setActionNotice("Настройки сохранены.");
    onCloseSettingsEdit();
  }

  function confirmDangerousAction() {
    setIsDangerDialogOpen(false);
    setActionNotice("Действие записано в audit log.");
  }

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="settings-workspace-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="settings-workspace-heading">Настройки админки</h2>
            <p>Группы системных правил: запись, платежи, email, privacy/SEO, роли и audit log.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры настроек">
            <button aria-pressed="true" type="button">
              Все группы
            </button>
          </div>
        </div>

        {actionNotice ? (
          <p className="admin-export-notice" role="status">
            {actionNotice}
          </p>
        ) : null}

        <div className="admin-table-scroll admin-settings-table-scroll">
          <table className="admin-data-table admin-settings-table">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Ключевые настройки</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((group) => (
                <tr aria-selected={isSettingsDrawerOpen && group.id === selectedGroup?.id} key={group.id}>
                  <td>
                    <Link
                      className="admin-row-action admin-row-link"
                      href={settingsDetailHref(group.id, role)}
                      onClick={() => openGroup(group.id)}
                    >
                      {group.title}
                    </Link>
                  </td>
                  <td>{group.summary}</td>
                  <td>
                    <span className={statusClass(group.status)}>{group.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredGroups.length === 0 ? <EmptyState label="Настройки не найдены." /> : null}
      </section>

      {isSettingsDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали настроек" kicker="Настройки" onClose={() => setIsSettingsDrawerOpen(false)}>
        {!selectedGroup ? (
          <>
            <div className="admin-detail-heading">
              <h2>Ничего не найдено</h2>
            </div>
            <p>Измените поиск, чтобы выбрать группу настроек.</p>
          </>
        ) : (
          <>
        <div className="admin-detail-heading">
          <h2>{selectedGroup.title}</h2>
          <div className="admin-detail-actions">
            <button className="admin-text-action" onClick={onOpenSettingsEdit} type="button">
              Редактировать
            </button>
          </div>
        </div>
        <p>{selectedGroup.summary}</p>

        {selectedGroup.id === "business" ? (
          <dl className="admin-detail-list">
            <div>
              <dt>Название</dt>
              <dd>{settings.businessName}</dd>
            </div>
            <div>
              <dt>Язык по умолчанию</dt>
              <dd>{settings.defaultLocale}</dd>
            </div>
            <div>
              <dt>Часовой пояс</dt>
              <dd>{settings.timezone}</dd>
            </div>
            <div>
              <dt>Обновлено</dt>
              <dd>{settings.updatedAt}</dd>
            </div>
          </dl>
        ) : null}

        {selectedGroup.id === "booking" ? (
          <dl className="admin-detail-list">
            <div>
              <dt>Рабочие дни</dt>
              <dd>{settings.workingDays}</dd>
            </div>
            <div>
              <dt>Рабочие часы</dt>
              <dd>{settings.workingHours}</dd>
            </div>
            <div>
              <dt>Перерыв между сеансами</dt>
              <dd>{settings.bookingBufferMinutes} минут</dd>
            </div>
            <div>
              <dt>Слотов в день</dt>
              <dd>{settings.dailySlotCapacity} слотов</dd>
            </div>
            <div>
              <dt>Google Calendar</dt>
              <dd>{settings.googleCalendarMode}</dd>
            </div>
            <div>
              <dt>Google Calendar ID</dt>
              <dd>{settings.googleCalendarId || "Не подключен"}</dd>
            </div>
            <div>
              <dt>Источник записей</dt>
              <dd>Админка остается главным календарем.</dd>
            </div>
          </dl>
        ) : null}

        {selectedGroup.id === "payments" ? (
          <dl className="admin-detail-list">
            <div>
              <dt>Валюта</dt>
              <dd>{settings.currency}</dd>
            </div>
            <div>
              <dt>Stripe режим</dt>
              <dd>{settings.stripeMode}</dd>
            </div>
            <div>
              <dt>Сертификаты</dt>
              <dd>Оплата сертификатов через Stripe; услуги массажа без online payment в v1.</dd>
            </div>
          </dl>
        ) : null}

        {selectedGroup.id === "email" ? (
          <dl className="admin-detail-list">
            <div>
              <dt>Email отправителя</dt>
              <dd>{settings.emailSender}</dd>
            </div>
            <div>
              <dt>Шаблон напоминания</dt>
              <dd>{settings.reminderTemplate}</dd>
            </div>
          </dl>
        ) : null}

        {selectedGroup.id === "privacySeo" ? (
          <dl className="admin-detail-list">
            <div>
              <dt>Cookie/privacy</dt>
              <dd>{settings.cookiePrivacyMode}</dd>
            </div>
            <div>
              <dt>SEO title</dt>
              <dd>{settings.defaultSeoTitle}</dd>
            </div>
          </dl>
        ) : null}

        {selectedGroup.id === "rolesAudit" ? (
          <>
            <dl className="admin-detail-list">
              <div>
                <dt>Политика ролей</dt>
                <dd>{settings.rolesPolicy}</dd>
              </div>
              <div>
                <dt>Бухгалтер</dt>
                <dd>Бухгалтер: только Stripe-отчеты</dd>
              </div>
              <div>
                <dt>Audit log</dt>
                <dd>{settings.auditLogRetentionDays} дней хранения</dd>
              </div>
            </dl>
            <section className="admin-client-section">
              <h3>Опасная зона</h3>
              <p>Действия с данными должны быть отделены от обычного сохранения и подтверждаться владельцем.</p>
              <button className="admin-danger-button" onClick={() => setIsDangerDialogOpen(true)} type="button">
                Сбросить демо-данные
              </button>
            </section>
          </>
        ) : null}
          </>
        )}
        </AdminDetailDrawer>
      ) : null}

      {isSettingsEditOpen ? (
        <SettingsDialog key={settings.updatedAt} onClose={onCloseSettingsEdit} onSave={saveSettingsForm} settings={settings} />
      ) : null}

      {isDangerDialogOpen ? <DangerousSettingsDialog onClose={() => setIsDangerDialogOpen(false)} onConfirm={confirmDangerousAction} /> : null}
    </div>
  );
}

function UsersWorkspace({
  adminUsers,
  isUserCreateOpen,
  onCloseUserCreate,
  onSaveAdminUser,
  query,
  role,
  selectedAdminUserId,
}: {
  adminUsers: AdminUserRecord[];
  isUserCreateOpen: boolean;
  onCloseUserCreate: () => void;
  onSaveAdminUser: (user: AdminUserRecord, originalId?: string) => void;
  query: string;
  role: AdminRoleId;
  selectedAdminUserId?: string;
}) {
  const initialSelectedAdminUser = selectedAdminUserId
    ? adminUsers.find((adminUser) => adminUser.id === selectedAdminUserId)
    : undefined;
  const [selectedUserId, setSelectedUserId] = useState(initialSelectedAdminUser?.id ?? adminUsers[0]?.id ?? "");
  const [isUserDrawerOpen, setIsUserDrawerOpen] = useState(Boolean(initialSelectedAdminUser));
  const [editingUser, setEditingUser] = useState<AdminUserRecord | undefined>();
  const [userFilter, setUserFilter] = useState<AdminUserFilterId>("all");
  const filteredUsers = adminUsers.filter((adminUser) => {
    const permissions = adminRolePermissionSummary[adminUser.role];

    return (
      matchesAdminUserFilter(adminUser, userFilter) &&
      matchesSearch(
        [
          adminUser.name,
          adminUser.email,
          adminUser.status,
          roleLabels[adminUser.role],
          permissions.scope,
          ...permissions.items,
          adminUser.accessNote,
          adminUser.lastLogin,
        ],
        query,
      )
    );
  });
  const selectedUser =
    filteredUsers.find((adminUser) => adminUser.id === selectedUserId) ??
    filteredUsers[0] ??
    adminUsers.find((adminUser) => adminUser.id === selectedUserId);
  const isUserFormOpen = isUserCreateOpen || Boolean(editingUser);

  function openUser(user: AdminUserRecord) {
    setSelectedUserId(user.id);
    setIsUserDrawerOpen(true);
  }

  function openUserEdit(user: AdminUserRecord) {
    onCloseUserCreate();
    setEditingUser(user);
  }

  function closeUserForm() {
    setEditingUser(undefined);
    onCloseUserCreate();
  }

  function saveUserForm(user: AdminUserRecord, originalId?: string) {
    onSaveAdminUser(user, originalId);
    setSelectedUserId(user.id);
    setIsUserDrawerOpen(true);
    closeUserForm();
  }

  if (!selectedUser) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="users-heading">
        <div className="admin-panel-head">
          <h2 id="users-heading">Пользователи админки</h2>
        </div>
        <EmptyState label="Пользователи пока не заведены." />
        {isUserFormOpen ? (
          <AdminUserDialog
            initialUser={editingUser}
            key={editingUser?.id ?? "new-admin-user"}
            onClose={closeUserForm}
            onSave={saveUserForm}
          />
        ) : null}
      </section>
    );
  }

  const selectedPermissions = adminRolePermissionSummary[selectedUser.role];
  const accountantScopeLabel =
    selectedUser.role === "accountant"
      ? "Stripe-отчеты доступны только для налогов."
      : "Stripe-отчеты недоступны в ограниченном бухгалтерском режиме.";

  return (
    <div className="admin-split-view admin-content-workspace">
      <section className="admin-panel admin-panel-large" aria-labelledby="users-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="users-heading">Пользователи админки</h2>
            <p>Приглашения, роли, статусы доступа, 2FA и журнал входов сотрудников.</p>
          </div>
          <div className="admin-filter-row" aria-label="Фильтры пользователей">
            {adminUserFilterOptions.map((filter) => (
              <button
                aria-pressed={userFilter === filter.id}
                key={filter.id}
                onClick={() => setUserFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-table-scroll admin-users-table-scroll">
          <table className="admin-data-table admin-users-table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>2FA</th>
                <th>Последний вход</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((adminUser) => (
                <tr aria-selected={isUserDrawerOpen && adminUser.id === selectedUser.id} key={adminUser.id}>
                  <td>
                    <Link
                      className="admin-row-action admin-row-link"
                      href={userDetailHref(adminUser.id, role)}
                      onClick={() => openUser(adminUser)}
                    >
                      {adminUser.name}
                    </Link>
                  </td>
                  <td>{adminUser.email}</td>
                  <td>{roleLabels[adminUser.role]}</td>
                  <td>
                    <span className={statusClass(adminUser.status)}>{adminUser.status}</span>
                  </td>
                  <td>{adminUser.twoFactor ? "Включена" : "Нет"}</td>
                  <td className="admin-tabular">{adminUser.lastLogin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 ? <EmptyState label="Пользователи не найдены." /> : null}
      </section>

      {isUserDrawerOpen ? (
        <AdminDetailDrawer ariaLabel="Детали пользователя" kicker="Доступ" onClose={() => setIsUserDrawerOpen(false)}>
        <div className="admin-detail-heading">
          <h2>{selectedUser.name}</h2>
          <div className="admin-detail-actions">
            <button className="admin-text-action" onClick={() => openUserEdit(selectedUser)} type="button">
              Редактировать
            </button>
          </div>
        </div>

        <dl className="admin-detail-list">
          <div>
            <dt>Email</dt>
            <dd>{selectedUser.email}</dd>
          </div>
          <div>
            <dt>Роль</dt>
            <dd>{roleLabels[selectedUser.role]}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>
              <span className={statusClass(selectedUser.status)}>{selectedUser.status}</span>
            </dd>
          </div>
          <div>
            <dt>2FA</dt>
            <dd>{selectedUser.twoFactor ? "Включена" : "Не включена"}</dd>
          </div>
          <div>
            <dt>Последний вход</dt>
            <dd>{selectedUser.lastLogin}</dd>
          </div>
          <div>
            <dt>Режим бухгалтера</dt>
            <dd>{accountantScopeLabel}</dd>
          </div>
          <div>
            <dt>Комментарий</dt>
            <dd>{selectedUser.accessNote}</dd>
          </div>
        </dl>

        <section className="admin-client-section">
          <h3>Права роли</h3>
          <p>{selectedPermissions.scope}</p>
          <ul className="admin-client-history">
            {selectedPermissions.items.map((permission) => (
              <li key={permission}>
                <span>{permission}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-client-section">
          <h3>Audit log доступа</h3>
          <ul className="admin-client-history">
            {selectedUser.history.map((entry) => (
              <li key={entry}>
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </section>
        </AdminDetailDrawer>
      ) : null}

      {isUserFormOpen ? (
        <AdminUserDialog
          initialUser={editingUser}
          key={editingUser?.id ?? "new-admin-user"}
          onClose={closeUserForm}
          onSave={saveUserForm}
        />
      ) : null}
    </div>
  );
}

function GenericWorkspace({ query, section }: { query: string; section: AdminSectionId }) {
  const sectionModule = getAdminModule(section);
  const filteredItems = sectionSamples[section].filter((item) => matchesSearch([item, sectionModule.title], query));
  const [selectedItem, setSelectedItem] = useState(filteredItems[0] ?? sectionSamples[section][0]);
  const visibleSelectedItem = filteredItems.includes(selectedItem) ? selectedItem : filteredItems[0];

  return (
    <div className="admin-split-view">
      <section className="admin-panel admin-panel-large" aria-labelledby={`${section}-workspace-heading`}>
        <div className="admin-panel-head">
          <h2 id={`${section}-workspace-heading`}>Рабочий список</h2>
          <div className="admin-filter-row" aria-label="Фильтры раздела">
            <button aria-pressed="true" type="button">
              Все
            </button>
            <button type="button">Активные</button>
            <button type="button">Черновики</button>
          </div>
        </div>
        <div className="admin-module-grid">
          {filteredItems.map((item) => (
            <button className="admin-module-tile" key={item} onClick={() => setSelectedItem(item)} type="button">
              <strong>{item}</strong>
              <span>{sectionModule.title}</span>
            </button>
          ))}
        </div>
        {filteredItems.length === 0 ? <EmptyState label="Элементы не найдены." /> : null}
      </section>

      <aside className="admin-panel admin-detail-panel" aria-label="Детали выбранного объекта">
        <span className="admin-kicker">Детали</span>
        <h2>{visibleSelectedItem ?? sectionModule.title}</h2>
        <p>{sectionModule.description}</p>
        <dl className="admin-detail-list">
          <div>
            <dt>Публикация</dt>
            <dd>
              <span className="admin-status admin-status-warning">Черновик</span>
            </dd>
          </div>
          <div>
            <dt>Локализации</dt>
            <dd>bg, ru, ua, en</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

function Workspace({
  adminUsers,
  appointments,
  blogPosts,
  calendarAppointmentFocus,
  certificates,
  clients,
  contactChannels,
  contactSettings,
  isBlogCreateOpen,
  isCertificateCreateOpen,
  isClientCreateOpen,
  isContactSettingsOpen,
  isMediaCreateOpen,
  isPriceCreateOpen,
  isServiceCreateOpen,
  isSettingsEditOpen,
  isUserCreateOpen,
  media,
  onCancelAppointment,
  onCalendarCreateIntent,
  onCalendarDateChange,
  onCloseBlogCreate,
  onCloseCertificateCreate,
  onCloseClientCreate,
  onCloseContactSettings,
  onCloseMediaCreate,
  onClosePriceCreate,
  onCloseServiceCreate,
  onCloseSettingsEdit,
  onCloseUserCreate,
  onEditAppointment,
  onOpenSettingsEdit,
  onSaveBlogPost,
  onSaveAdminUser,
  onSaveCertificate,
  onSaveClient,
  onSaveClientNote,
  onSaveContactChannel,
  onSaveContactSettings,
  onSaveMedia,
  onSavePrice,
  onSaveService,
  onSaveSettings,
  onUpdateCertificateStatus,
  prices,
  query,
  role,
  section,
  selectedAdminUserId,
  selectedBlogPostId,
  selectedCalendarDate,
  selectedCertificateCode,
  selectedClientName,
  selectedContactId,
  selectedMediaId,
  selectedPriceId,
  selectedServiceSlug,
  selectedSettingsGroupId,
  services,
  settings,
}: {
  adminUsers: AdminUserRecord[];
  appointments: Appointment[];
  blogPosts: BlogPostRecord[];
  calendarAppointmentFocus?: CalendarAppointmentFocus;
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  contactChannels: ContactChannelRecord[];
  contactSettings: ContactSettingsRecord;
  isBlogCreateOpen: boolean;
  isCertificateCreateOpen: boolean;
  isClientCreateOpen: boolean;
  isContactSettingsOpen: boolean;
  isMediaCreateOpen: boolean;
  isPriceCreateOpen: boolean;
  isServiceCreateOpen: boolean;
  isSettingsEditOpen: boolean;
  isUserCreateOpen: boolean;
  media: MediaRecord[];
  onCancelAppointment: (appointment: Appointment) => void;
  onCalendarCreateIntent: () => void;
  onCalendarDateChange: (date: string) => void;
  onCloseBlogCreate: () => void;
  onCloseCertificateCreate: () => void;
  onCloseClientCreate: () => void;
  onCloseContactSettings: () => void;
  onCloseMediaCreate: () => void;
  onClosePriceCreate: () => void;
  onCloseServiceCreate: () => void;
  onCloseSettingsEdit: () => void;
  onCloseUserCreate: () => void;
  onEditAppointment: (appointment: Appointment) => void;
  onOpenSettingsEdit: () => void;
  onSaveAdminUser: (user: AdminUserRecord, originalId?: string) => void;
  onSaveBlogPost: (post: BlogPostRecord, originalId?: string) => void;
  onSaveCertificate: (certificate: CertificateRecord, originalCode?: string) => void;
  onSaveClient: (client: ClientRecord, originalClientName?: string) => void;
  onSaveClientNote: (clientName: string, note: string) => void;
  onSaveContactChannel: (channel: ContactChannelRecord, originalId?: string) => void;
  onSaveContactSettings: (settings: ContactSettingsRecord) => void;
  onSaveMedia: (media: MediaRecord, originalId?: string) => void;
  onSavePrice: (price: PriceRecord, originalId?: string) => void;
  onSaveService: (service: ServiceRecord, originalSlug?: string) => void;
  onSaveSettings: (settings: SettingsRecord) => void;
  onUpdateCertificateStatus: (certificateCode: string, status: CertificateStatus, historyEntry: string) => void;
  prices: PriceRecord[];
  query: string;
  role: AdminRoleId;
  section: AdminSectionId;
  selectedAdminUserId?: string;
  selectedBlogPostId?: string;
  selectedCalendarDate?: string;
  selectedCertificateCode?: string;
  selectedClientName?: string;
  selectedContactId?: string;
  selectedMediaId?: string;
  selectedPriceId?: string;
  selectedServiceSlug?: string;
  selectedSettingsGroupId?: string;
  services: ServiceRecord[];
  settings: SettingsRecord;
}) {
  if (section === "dashboard") {
    return <DashboardWorkspace appointments={appointments} certificates={certificates} clients={clients} query={query} role={role} />;
  }

  if (section === "clients") {
    return (
      <ClientsWorkspace
        appointments={appointments}
        certificates={certificates}
        clients={clients}
        isClientCreateOpen={isClientCreateOpen}
        key={selectedClientName ?? "default-client"}
        onCalendarCreateIntent={onCalendarCreateIntent}
        onCloseClientCreate={onCloseClientCreate}
        onSaveCertificate={onSaveCertificate}
        onSaveClient={onSaveClient}
        onSaveClientNote={onSaveClientNote}
        query={query}
        role={role}
        selectedClientName={selectedClientName}
      />
    );
  }

  if (section === "certificates") {
    return (
      <CertificatesWorkspace
        certificates={certificates}
        clients={clients}
        isCertificateCreateOpen={isCertificateCreateOpen}
        key={`${selectedCertificateCode ?? "default-certificate"}:${selectedClientName ?? "all-clients"}`}
        onCloseCertificateCreate={onCloseCertificateCreate}
        onSaveCertificate={onSaveCertificate}
        onUpdateCertificateStatus={onUpdateCertificateStatus}
        query={query}
        role={role}
        selectedCertificateCode={selectedCertificateCode}
        selectedClientName={selectedClientName}
      />
    );
  }

  if (section === "services") {
    return (
      <ServicesWorkspace
        isServiceCreateOpen={isServiceCreateOpen}
        onCloseServiceCreate={onCloseServiceCreate}
        onSaveService={onSaveService}
        prices={prices}
        query={query}
        role={role}
        selectedServiceSlug={selectedServiceSlug}
        services={services}
        key={selectedServiceSlug ?? "default-service"}
      />
    );
  }

  if (section === "price") {
    return (
      <PriceWorkspace
        isPriceCreateOpen={isPriceCreateOpen}
        onClosePriceCreate={onClosePriceCreate}
        onSavePrice={onSavePrice}
        prices={prices}
        query={query}
        role={role}
        selectedPriceId={selectedPriceId}
        services={services}
        key={selectedPriceId ?? "default-price"}
      />
    );
  }

  if (section === "media") {
    return (
      <MediaWorkspace
        isMediaCreateOpen={isMediaCreateOpen}
        key={selectedMediaId ?? "default-media"}
        media={media}
        onCloseMediaCreate={onCloseMediaCreate}
        onSaveMedia={onSaveMedia}
        query={query}
        role={role}
        selectedMediaId={selectedMediaId}
      />
    );
  }

  if (section === "contacts") {
    return (
      <ContactsWorkspace
        contactChannels={contactChannels}
        contactSettings={contactSettings}
        isContactSettingsOpen={isContactSettingsOpen}
        key={selectedContactId ?? "default-contact"}
        onCloseContactSettings={onCloseContactSettings}
        onSaveContactChannel={onSaveContactChannel}
        onSaveContactSettings={onSaveContactSettings}
        query={query}
        role={role}
        selectedContactId={selectedContactId}
      />
    );
  }

  if (section === "blog") {
    return (
      <BlogWorkspace
        blogPosts={blogPosts}
        isBlogCreateOpen={isBlogCreateOpen}
        key={selectedBlogPostId ?? "default-blog"}
        onCloseBlogCreate={onCloseBlogCreate}
        onSaveBlogPost={onSaveBlogPost}
        query={query}
        role={role}
        selectedBlogPostId={selectedBlogPostId}
      />
    );
  }

  if (section === "users") {
    return (
      <UsersWorkspace
        adminUsers={adminUsers}
        isUserCreateOpen={isUserCreateOpen}
        key={selectedAdminUserId ?? "default-admin-user"}
        onCloseUserCreate={onCloseUserCreate}
        onSaveAdminUser={onSaveAdminUser}
        query={query}
        role={role}
        selectedAdminUserId={selectedAdminUserId}
      />
    );
  }

  if (section === "settings") {
    return (
      <SettingsWorkspace
        isSettingsEditOpen={isSettingsEditOpen}
        key={selectedSettingsGroupId ?? "default-settings"}
        onCloseSettingsEdit={onCloseSettingsEdit}
        onOpenSettingsEdit={onOpenSettingsEdit}
        onSaveSettings={onSaveSettings}
        query={query}
        role={role}
        selectedSettingsGroupId={selectedSettingsGroupId}
        settings={settings}
      />
    );
  }

  if (section === "calendar") {
    return (
      <CalendarWorkspace
        appointments={appointments}
        bookingBufferMinutes={settings.bookingBufferMinutes}
        clients={clients}
        dailySlotCapacity={settings.dailySlotCapacity}
        key={`${selectedCalendarDate ?? "default-calendar"}:${selectedClientName ?? "all-clients"}:${calendarAppointmentFocus?.appointmentKey ?? "default-focus"}`}
        onCancelAppointment={onCancelAppointment}
        onCalendarDateChange={onCalendarDateChange}
        onEditAppointment={onEditAppointment}
        query={query}
        role={role}
        selectedAppointmentFocus={calendarAppointmentFocus}
        selectedCalendarDate={selectedCalendarDate}
        selectedClientName={selectedClientName}
      />
    );
  }

  if (section === "finances") {
    return <FinanceWorkspace query={query} />;
  }

  return <GenericWorkspace query={query} section={section} />;
}

export function AdminShell({
  activeSection,
  calendarAction,
  role,
  selectedAppointmentKey,
  selectedAdminUserId,
  selectedBlogPostId,
  selectedCalendarDate,
  selectedCertificateCode,
  selectedClientName,
  selectedContactId,
  selectedMediaId,
  selectedPriceId,
  selectedServiceSlug,
  selectedSettingsGroupId,
}: AdminShellProps) {
  const navigation = getAdminNavigationForRole(role);
  const activeModule = getAdminModule(activeSection);
  const [query, setQuery] = useState("");
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | undefined>();
  const [dismissedCalendarActionKey, setDismissedCalendarActionKey] = useState("");
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>();
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>(() => buildInitialCalendarAppointments());
  const [clients, setClients] = useState<ClientRecord[]>(() => buildInitialClientRows());
  const [certificates, setCertificates] = useState<CertificateRecord[]>(() => buildInitialCertificateRows());
  const [services, setServices] = useState<ServiceRecord[]>(() => buildInitialServiceRows());
  const [prices, setPrices] = useState<PriceRecord[]>(() => buildInitialPriceRows());
  const [media, setMedia] = useState<MediaRecord[]>(() => buildInitialMediaRows());
  const [contactChannels, setContactChannels] = useState<ContactChannelRecord[]>(() => buildInitialContactChannels());
  const [contactSettings, setContactSettings] = useState<ContactSettingsRecord>(() => buildInitialContactSettings());
  const [blogPosts, setBlogPosts] = useState<BlogPostRecord[]>(() => buildInitialBlogPostRows());
  const [settings, setSettings] = useState<SettingsRecord>(() => buildInitialSettingsRecord());
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>(() => buildInitialAdminUsers());
  const selectedRouteAppointment = selectedAppointmentKey
    ? calendarAppointments.find((appointment) => appointmentKey(appointment) === selectedAppointmentKey)
    : undefined;
  const selectedCalendarRouteDate = isCalendarMonthDate(selectedCalendarDate)
    ? selectedCalendarDate
    : selectedRouteAppointment?.date;
  const routeCalendarAppointmentFocus = selectedRouteAppointment
    ? {
        appointmentKey: appointmentKey(selectedRouteAppointment),
        date: selectedRouteAppointment.date,
        routeDate: selectedCalendarRouteDate,
      }
    : undefined;
  const [calendarSelection, setCalendarSelection] = useState(() => ({
    date: selectedCalendarRouteDate ?? "2026-07-06",
    routeDate: selectedCalendarRouteDate,
  }));
  const [calendarAppointmentFocus, setCalendarAppointmentFocus] = useState<CalendarAppointmentFocus | undefined>();
  const activeCalendarAppointmentFocus =
    calendarAppointmentFocus?.routeDate === selectedCalendarRouteDate ? calendarAppointmentFocus : routeCalendarAppointmentFocus;
  const activeCalendarDate =
    calendarSelection.routeDate === selectedCalendarRouteDate
      ? calendarSelection.date
      : (selectedCalendarRouteDate ?? "2026-07-06");
  const [isClientCreateOpen, setIsClientCreateOpen] = useState(false);
  const [isCertificateCreateOpen, setIsCertificateCreateOpen] = useState(false);
  const [isServiceCreateOpen, setIsServiceCreateOpen] = useState(false);
  const [isPriceCreateOpen, setIsPriceCreateOpen] = useState(false);
  const [isMediaCreateOpen, setIsMediaCreateOpen] = useState(false);
  const [isContactSettingsOpen, setIsContactSettingsOpen] = useState(false);
  const [isBlogCreateOpen, setIsBlogCreateOpen] = useState(false);
  const [isSettingsEditOpen, setIsSettingsEditOpen] = useState(false);
  const [isUserCreateOpen, setIsUserCreateOpen] = useState(false);
  const calendarActionKey = `${activeSection}:${role}:${calendarAction ?? "none"}:${selectedClientName ?? ""}`;
  const shouldOpenCalendarCreateDialog =
    activeSection === "calendar" && calendarAction === "create" && dismissedCalendarActionKey !== calendarActionKey;
  const isCalendarActionDialogOpen = activeSection === "calendar" && (isActionOpen || shouldOpenCalendarCreateDialog);
  const shouldPrefillCalendarClient = shouldOpenCalendarCreateDialog && !isActionOpen && !editingAppointment;
  const prefilledCalendarClient = shouldPrefillCalendarClient ? findClientByIdentity(clients, selectedClientName) : undefined;
  const calendarDialogKey = editingAppointment
    ? `edit-${appointmentKey(editingAppointment)}`
    : shouldPrefillCalendarClient
      ? `prefill-${calendarActionKey}`
      : "new-empty-appointment";

  function handleAppointmentCreate(appointment: Appointment) {
    const createdAppointment = {
      ...appointment,
      id: `custom-${calendarAppointments.length + 1}`,
    };

    setCalendarAppointments((current) => sortAppointments([...current, createdAppointment]));

    return createdAppointment;
  }

  function handleAppointmentUpdate(appointment: Appointment) {
    setCalendarAppointments((current) =>
      sortAppointments(
        current.map((currentAppointment) =>
          appointmentKey(currentAppointment) === appointmentKey(appointment) ? appointment : currentAppointment,
        ),
      ),
    );
  }

  function updateActiveCalendarDate(date: string) {
    setCalendarSelection({
      date,
      routeDate: selectedCalendarRouteDate,
    });
  }

  function openPrimaryAction() {
    setEditingAppointment(undefined);

    if (activeSection === "clients") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      setIsClientCreateOpen(true);
      return;
    }

    if (activeSection === "users") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(true);
      return;
    }

    if (activeSection === "certificates") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      setIsCertificateCreateOpen(true);
      return;
    }

    if (activeSection === "services") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      setIsServiceCreateOpen(true);
      return;
    }

    if (activeSection === "price") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      setIsPriceCreateOpen(true);
      return;
    }

    if (activeSection === "media") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      setIsMediaCreateOpen(true);
      return;
    }

    if (activeSection === "contacts") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      setIsContactSettingsOpen(true);
      return;
    }

    if (activeSection === "blog") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(true);
      setIsSettingsEditOpen(false);
      setIsUserCreateOpen(false);
      return;
    }

    if (activeSection === "settings") {
      setCancellingAppointment(undefined);
      setIsActionOpen(false);
      setIsCertificateCreateOpen(false);
      setIsClientCreateOpen(false);
      setIsContactSettingsOpen(false);
      setIsMediaCreateOpen(false);
      setIsPriceCreateOpen(false);
      setIsServiceCreateOpen(false);
      setIsBlogCreateOpen(false);
      setIsUserCreateOpen(false);
      setIsSettingsEditOpen(true);
      return;
    }

    setIsCertificateCreateOpen(false);
    setIsClientCreateOpen(false);
    setIsContactSettingsOpen(false);
    setIsMediaCreateOpen(false);
    setIsPriceCreateOpen(false);
    setIsServiceCreateOpen(false);
    setIsBlogCreateOpen(false);
    setIsSettingsEditOpen(false);
    setIsUserCreateOpen(false);
    setIsActionOpen(true);
  }

  function openAppointmentEdit(appointment: Appointment) {
    setCancellingAppointment(undefined);
    setIsCertificateCreateOpen(false);
    setIsClientCreateOpen(false);
    setIsContactSettingsOpen(false);
    setIsMediaCreateOpen(false);
    setIsPriceCreateOpen(false);
    setIsServiceCreateOpen(false);
    setIsBlogCreateOpen(false);
    setIsSettingsEditOpen(false);
    setIsUserCreateOpen(false);
    setEditingAppointment(appointment);
    setIsActionOpen(true);
  }

  function openAppointmentCancel(appointment: Appointment) {
    setEditingAppointment(undefined);
    setIsActionOpen(false);
    setIsCertificateCreateOpen(false);
    setIsClientCreateOpen(false);
    setIsContactSettingsOpen(false);
    setIsMediaCreateOpen(false);
    setIsPriceCreateOpen(false);
    setIsServiceCreateOpen(false);
    setIsBlogCreateOpen(false);
    setIsSettingsEditOpen(false);
    setIsUserCreateOpen(false);
    setCancellingAppointment(appointment);
  }

  function prepareCalendarCreateFromClient() {
    setDismissedCalendarActionKey("");
    setCancellingAppointment(undefined);
    setEditingAppointment(undefined);
    setIsCertificateCreateOpen(false);
    setIsClientCreateOpen(false);
    setIsContactSettingsOpen(false);
    setIsMediaCreateOpen(false);
    setIsPriceCreateOpen(false);
    setIsServiceCreateOpen(false);
    setIsBlogCreateOpen(false);
    setIsSettingsEditOpen(false);
    setIsUserCreateOpen(false);
    setIsActionOpen(false);
  }

  function closeActionDialog() {
    setDismissedCalendarActionKey(calendarActionKey);
    setIsActionOpen(false);
    setIsCertificateCreateOpen(false);
    setIsClientCreateOpen(false);
    setIsContactSettingsOpen(false);
    setIsMediaCreateOpen(false);
    setIsPriceCreateOpen(false);
    setIsServiceCreateOpen(false);
    setIsBlogCreateOpen(false);
    setIsSettingsEditOpen(false);
    setIsUserCreateOpen(false);
    setEditingAppointment(undefined);
  }

  function closeCancelDialog() {
    setCancellingAppointment(undefined);
  }

  function saveCalendarAppointment(appointment: Appointment) {
    if (editingAppointment) {
      handleAppointmentUpdate(appointment);
    } else {
      const createdAppointment = handleAppointmentCreate(appointment);
      updateActiveCalendarDate(createdAppointment.date);
      setCalendarAppointmentFocus({
        appointmentKey: appointmentKey(createdAppointment),
        date: createdAppointment.date,
        routeDate: selectedCalendarRouteDate,
      });
    }

    closeActionDialog();
  }

  function cancelCalendarAppointment(appointment: Appointment) {
    handleAppointmentUpdate({ ...appointment, status: "Отменена" });
    closeCancelDialog();
  }

  function saveClientNote(clientIdentity: string, note: string) {
    setClients((current) =>
      current.map((client) => (matchesClientIdentity(client, clientIdentity) ? { ...client, note } : client)),
    );
  }

  function saveClientRecord(client: ClientRecord, originalClientIdentity?: string) {
    setClients((current) => {
      const nextPhone = normalizeClientPhone(client.phone);
      const existingIndex = current.findIndex((currentClient) => {
        if (originalClientIdentity) {
          return matchesClientIdentity(currentClient, originalClientIdentity);
        }

        return Boolean(nextPhone) && normalizeClientPhone(currentClient.phone) === nextPhone;
      });

      if (existingIndex === -1) {
        return [...current, client];
      }

      return current.map((currentClient, index) => (index === existingIndex ? client : currentClient));
    });
  }

  function saveCertificateRecord(certificate: CertificateRecord, originalCode?: string) {
    setCertificates((current) => {
      const originalKey = originalCode ? normalizeSearch(originalCode) : "";
      const nextKey = normalizeSearch(certificate.code);
      const existingIndex = current.findIndex((currentCertificate) => {
        if (originalKey) {
          return normalizeSearch(currentCertificate.code) === originalKey;
        }

        return normalizeSearch(currentCertificate.code) === nextKey;
      });

      if (existingIndex === -1) {
        return [...current, certificate];
      }

      return current.map((currentCertificate, index) => (index === existingIndex ? certificate : currentCertificate));
    });
  }

  function updateCertificateStatus(certificateCode: string, status: CertificateStatus, historyEntry: string) {
    setCertificates((current) =>
      current.map((certificate) =>
        normalizeSearch(certificate.code) === normalizeSearch(certificateCode)
          ? {
              ...certificate,
              history: [historyEntry, ...certificate.history],
              status,
            }
          : certificate,
      ),
    );
  }

  function saveServiceRecord(service: ServiceRecord, originalSlug?: string) {
    if (originalSlug && normalizeSearch(originalSlug) !== normalizeSearch(service.slug)) {
      setPrices((current) =>
        current.map((price) =>
          normalizeSearch(price.serviceSlug) === normalizeSearch(originalSlug) ? { ...price, serviceSlug: service.slug } : price,
        ),
      );
    }

    setServices((current) => {
      const originalKey = originalSlug ? normalizeSearch(originalSlug) : "";
      const nextKey = normalizeSearch(service.slug);
      const existingIndex = current.findIndex((currentService) => {
        if (originalKey) {
          return normalizeSearch(currentService.slug) === originalKey;
        }

        return normalizeSearch(currentService.slug) === nextKey;
      });

      if (existingIndex === -1) {
        return [...current, service];
      }

      return current.map((currentService, index) => (index === existingIndex ? service : currentService));
    });
  }

  function savePriceRecord(price: PriceRecord, originalId?: string) {
    setPrices((current) => {
      const originalKey = originalId ? normalizeSearch(originalId) : "";
      const nextKey = normalizeSearch(price.id);
      const existingIndex = current.findIndex((currentPrice) => {
        if (originalKey) {
          return normalizeSearch(currentPrice.id) === originalKey;
        }

        return normalizeSearch(currentPrice.id) === nextKey;
      });

      if (existingIndex === -1) {
        return [...current, price];
      }

      return current.map((currentPrice, index) => (index === existingIndex ? price : currentPrice));
    });
  }

  function saveMediaRecord(mediaRecord: MediaRecord, originalId?: string) {
    setMedia((current) => {
      const originalKey = originalId ? normalizeSearch(originalId) : "";
      const nextKey = normalizeSearch(mediaRecord.id);
      const existingIndex = current.findIndex((currentMedia) => {
        if (originalKey) {
          return normalizeSearch(currentMedia.id) === originalKey;
        }

        return normalizeSearch(currentMedia.id) === nextKey || normalizeSearch(currentMedia.url) === normalizeSearch(mediaRecord.url);
      });

      if (existingIndex === -1) {
        return [...current, mediaRecord];
      }

      return current.map((currentMedia, index) => (index === existingIndex ? mediaRecord : currentMedia));
    });
  }

  function saveContactSettingsRecord(settings: ContactSettingsRecord) {
    setContactSettings(settings);
    setContactChannels((current) =>
      current.map((channel) => {
        if (channel.id === "contact-phone") {
          return { ...channel, value: settings.phone };
        }

        if (channel.id === "contact-email") {
          return { ...channel, value: settings.email };
        }

        if (channel.id === "contact-map") {
          return { ...channel, value: settings.mapUrl };
        }

        if (channel.id === "contact-studio24") {
          return { ...channel, value: settings.bookingUrl };
        }

        return channel;
      }),
    );
    setIsContactSettingsOpen(false);
  }

  function saveContactChannelRecord(channel: ContactChannelRecord, originalId?: string) {
    setContactChannels((current) => {
      const originalKey = originalId ? normalizeSearch(originalId) : "";
      const nextKey = normalizeSearch(channel.id);
      const existingIndex = current.findIndex((currentChannel) => {
        if (originalKey) {
          return normalizeSearch(currentChannel.id) === originalKey;
        }

        return normalizeSearch(currentChannel.id) === nextKey || normalizeSearch(currentChannel.value) === normalizeSearch(channel.value);
      });

      if (existingIndex === -1) {
        return [...current, channel];
      }

      return current.map((currentChannel, index) => (index === existingIndex ? channel : currentChannel));
    });
  }

  function saveBlogPostRecord(post: BlogPostRecord, originalId?: string) {
    setBlogPosts((current) => {
      const originalKey = originalId ? normalizeSearch(originalId) : "";
      const nextKey = normalizeSearch(post.id);
      const existingIndex = current.findIndex((currentPost) => {
        if (originalKey) {
          return normalizeSearch(currentPost.id) === originalKey;
        }

        return normalizeSearch(currentPost.id) === nextKey || normalizeSearch(currentPost.slug) === normalizeSearch(post.slug);
      });

      if (existingIndex === -1) {
        return [...current, post];
      }

      return current.map((currentPost, index) => (index === existingIndex ? post : currentPost));
    });
  }

  function saveAdminUserRecord(user: AdminUserRecord, originalId?: string) {
    setAdminUsers((current) => {
      const originalKey = originalId ? normalizeSearch(originalId) : "";
      const nextKey = normalizeSearch(user.id);
      const nextEmail = normalizeSearch(user.email);
      const existingIndex = current.findIndex((currentUser) => {
        if (originalKey) {
          return normalizeSearch(currentUser.id) === originalKey;
        }

        return normalizeSearch(currentUser.id) === nextKey || normalizeSearch(currentUser.email) === nextEmail;
      });

      if (existingIndex === -1) {
        return [...current, user];
      }

      return current.map((currentUser, index) => (index === existingIndex ? user : currentUser));
    });
  }

  function saveSettingsRecord(nextSettings: SettingsRecord) {
    setSettings(nextSettings);
    setIsSettingsEditOpen(false);
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href={`/admin?role=${role}`} aria-label="Magic Massage Natali admin home">
          <span>MMN</span>
          <strong>Magic Massage Natali</strong>
        </Link>

        <nav className="admin-nav" aria-label="Admin sections">
          {groupedNavigation.map((group) => {
            const groupItems = navigation.filter((item) => item.group === group);

            if (groupItems.length === 0) {
              return null;
            }

            return (
              <div className="admin-nav-group" key={group}>
                <span>{group}</span>
                {groupItems.map((item) => (
                  <Link
                    aria-current={item.id === activeSection ? "page" : undefined}
                    href={`/admin?section=${item.id}&role=${role}`}
                    key={item.id}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-search" role="search">
            <label htmlFor="admin-search-input">Поиск</label>
            <input
              id="admin-search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Клиент, сертификат, платеж"
              type="search"
              value={query}
            />
          </div>
          <div className="admin-user-chip" aria-label="Текущая роль и профиль">
            <span>{roleLabels[role]}</span>
            <strong>Профиль</strong>
          </div>
        </header>

        <section className="admin-page-head" aria-labelledby="admin-page-title">
          <div>
            <span className="admin-kicker">{activeModule.group}</span>
            <h1 id="admin-page-title">{activeModule.title}</h1>
            <p>{activeModule.description}</p>
          </div>
          <button onClick={openPrimaryAction} type="button">
            {activeModule.primaryAction}
          </button>
        </section>

        <Workspace
          adminUsers={adminUsers}
          appointments={calendarAppointments}
          blogPosts={blogPosts}
          calendarAppointmentFocus={activeCalendarAppointmentFocus}
          certificates={certificates}
          clients={clients}
          contactChannels={contactChannels}
          contactSettings={contactSettings}
          isBlogCreateOpen={isBlogCreateOpen}
          isCertificateCreateOpen={isCertificateCreateOpen}
          isClientCreateOpen={isClientCreateOpen}
          isContactSettingsOpen={isContactSettingsOpen}
          isMediaCreateOpen={isMediaCreateOpen}
          isPriceCreateOpen={isPriceCreateOpen}
          isServiceCreateOpen={isServiceCreateOpen}
          isSettingsEditOpen={isSettingsEditOpen}
          isUserCreateOpen={isUserCreateOpen}
          media={media}
          onCancelAppointment={openAppointmentCancel}
          onCalendarCreateIntent={prepareCalendarCreateFromClient}
          onCalendarDateChange={updateActiveCalendarDate}
          onCloseBlogCreate={() => setIsBlogCreateOpen(false)}
          onCloseCertificateCreate={() => setIsCertificateCreateOpen(false)}
          onCloseClientCreate={() => setIsClientCreateOpen(false)}
          onCloseContactSettings={() => setIsContactSettingsOpen(false)}
          onCloseMediaCreate={() => setIsMediaCreateOpen(false)}
          onClosePriceCreate={() => setIsPriceCreateOpen(false)}
          onCloseServiceCreate={() => setIsServiceCreateOpen(false)}
          onCloseSettingsEdit={() => setIsSettingsEditOpen(false)}
          onCloseUserCreate={() => setIsUserCreateOpen(false)}
          onEditAppointment={openAppointmentEdit}
          onOpenSettingsEdit={() => setIsSettingsEditOpen(true)}
          onSaveAdminUser={saveAdminUserRecord}
          onSaveBlogPost={saveBlogPostRecord}
          onSaveCertificate={saveCertificateRecord}
          onSaveClient={saveClientRecord}
          onSaveClientNote={saveClientNote}
          onSaveContactChannel={saveContactChannelRecord}
          onSaveContactSettings={saveContactSettingsRecord}
          onSaveMedia={saveMediaRecord}
          onSavePrice={savePriceRecord}
          onSaveService={saveServiceRecord}
          onSaveSettings={saveSettingsRecord}
          onUpdateCertificateStatus={updateCertificateStatus}
          prices={prices}
          query={query}
          role={role}
          section={activeSection}
          selectedAdminUserId={selectedAdminUserId}
          selectedBlogPostId={selectedBlogPostId}
          selectedCalendarDate={selectedCalendarDate}
          selectedCertificateCode={selectedCertificateCode}
          selectedClientName={selectedClientName}
          selectedContactId={selectedContactId}
          selectedMediaId={selectedMediaId}
          selectedPriceId={selectedPriceId}
          selectedServiceSlug={selectedServiceSlug}
          selectedSettingsGroupId={selectedSettingsGroupId}
          services={services}
          settings={settings}
        />

        {isCalendarActionDialogOpen ? (
          <CalendarAppointmentDialog
            clients={clients}
            initialAppointment={editingAppointment}
            key={calendarDialogKey}
            onClose={closeActionDialog}
            onSave={saveCalendarAppointment}
            prefillClient={prefilledCalendarClient}
            prefillClientName={shouldPrefillCalendarClient ? selectedClientName : undefined}
            prefillDate={editingAppointment ? undefined : activeCalendarDate}
          />
        ) : isActionOpen ? (
          <QuickActionDialog
            action={activeModule.primaryAction}
            moduleTitle={activeModule.title}
            onClose={closeActionDialog}
          />
        ) : null}
        {cancellingAppointment ? (
          <CalendarAppointmentCancelDialog
            appointment={cancellingAppointment}
            onClose={closeCancelDialog}
            onConfirm={cancelCalendarAppointment}
          />
        ) : null}
      </main>
    </div>
  );
}
