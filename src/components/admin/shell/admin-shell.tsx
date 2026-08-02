"use client";

import { AdminLink as Link } from "@/components/admin/AdminLink";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  calculateFinanceSummary,
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
  financeRows as demoFinanceRows,
  sectionSamples,
  upcomingAppointments,
} from "@/admin/demo-data";
import type { AdminShellInitialData } from "@/admin/data-source";
import type { AdminUserActionInput, AdminUserActionResult } from "@/admin/admin-user-actions";
import type { AdminAuditAction, AdminDeleteInput, AdminPersistInput } from "@/admin/persistence";
import { normalizeMediaStatus } from "@/admin/media-status";
import { businessFacts, businessMapUrls } from "@/config/business";
import {
  cloneBusinessHoursSchedule,
  defaultBusinessHoursSchedule,
  formatBusinessHoursSummary,
  isBusinessHoursSchedule,
  type BusinessHoursDay,
} from "@/lib/business-hours";
import { matchesSearch, isValidEmail, parseCommaList } from "@/components/admin/lib/filters";
import { formatCurrency, isPositiveInteger, statusClass } from "@/components/admin/lib/formatters";
import { useTransientStatus } from "@/components/admin/lib/use-transient-status";
import {
  AdminDrawer,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerHeader,
  AdminDrawerSection,
  useAdminDrawerClose,
} from "@/components/admin/drawer";
import {
  adminSectionHref,
  appointmentKey,
  blogDetailHref,
  calendarAppointmentHref,
  calendarClientHref,
  calendarCreateHref,
  certificateClientHref,
  certificateDetailHref,
  clientProfileHref,
  contactDetailHref,
  mediaDetailHref,
  phoneHref,
  priceDetailHref,
  settingsDetailHref,
  userDetailHref,
  type SettingsGroupId,
} from "@/components/admin/lib/links";
import {
  CalendarAppointmentCancelDialog,
  CalendarAppointmentDialog,
  CalendarBlockDialog,
  CalendarTimeSelectionDialog,
  CalendarWorkspace,
  classifyAppointmentAgainstSchedule,
  createCalendarWorkingSchedule,
  createCalendarBlockMutationPayload,
  createSpecialistWorkingSchedule,
  formatCalendarDay,
  getSofiaIsoDate,
  hasScheduleEnvelope,
  hasAppointmentOverlap,
  isIsoDate,
  sortAppointments,
  type CalendarAppointmentFocus,
  type CalendarAppointmentSaveResult,
  type CalendarBlockSaveResult,
  type CalendarTimeSelection,
  type SpecialistScheduleSaveResult,
} from "@/components/admin/calendar";
import { getAdminAuthorizationHeader, signOutAdminBrowserSession } from "@/lib/supabase/browser";
import { AdminMobileHeader, AdminMobileNavigation } from "@/components/admin/mobile";
import { AdminSecurityAlerts } from "@/components/admin/security-alerts";
import { AdminRecordDeleteDialog } from "@/components/admin/AdminRecordDeleteDialog";
import { EmailNotificationStatusList, EmailTemplatePreview } from "@/components/admin/email-notifications";
import { GiftCertificateReconciliationList } from "@/components/admin/certificates/GiftCertificateReconciliationList";
import {
  MediaDetail,
  MediaGrid,
  MediaPlacementEditor,
  MediaUploader,
  type MediaUploadRequest,
} from "@/components/admin/media";
import { ServiceEditor, ServiceList } from "@/components/admin/services";
import {
  ClientContacts,
  ClientDetail,
  ClientForm,
  ClientNotes,
  ClientVisitHistory,
  PostVisitCommentQueue,
} from "@/components/admin/clients";
import {
  BLOG_LOCALES,
  BLOG_LOCALE_LABELS,
  BlogArticleEditor,
  BlogLocaleTabs,
  createEmptyBlogArticle,
  getBlogPostLocale,
  getBlogTranslationStatusLabel,
  groupLocalizedBlogArticles,
  serializeArticleDraft,
  type BlogArticleDraft,
  type BlogLocale,
  type BlogStatus as BlogEditorStatus,
} from "@/components/admin/blog";

import {
  certificateBelongsToClient,
  createAdminDemoRecords,
  findAppointmentClient,
  findNextClientAppointment,
  getAppointmentNotificationEmail,
  findCertificateClient,
  findClientAppointments,
  findClientByIdentity,
  findClientCertificates,
  getLocalDateTimeKey,
  matchesClientIdentity,
  normalizeClientPhone,
  normalizeSearch,
  reconcileClientAppointmentSummaries,
  type AdminDomainRecords,
  type AdminUserRecord,
  type AdminUserStatus,
  type Appointment,
  type BlogPostRecord,
  type BlogStatus,
  type CalendarBlock,
  type CalendarSyncMode,
  type CertificateRecord,
  type CertificateStatus,
  type ClientRecord,
  type ClientVisit,
  type ContactChannelRecord,
  type ContactChannelType,
  type ContactSettingsRecord,
  type ContactStatus,
  type MediaRecord,
  type MediaPlacementRecord,
  type MediaPublicationConsent,
  type MediaStatus,
  type MediaType,
  type PriceRecord,
  type PriceStatus,
  type ServiceRecord,
  type ServiceStatus,
  type SettingsRecord,
  type SpecialistRecord,
  type SpecialistScheduleDay,
  type StripeMode,
} from "@/admin/domain";

function getSofiaWalkInWindow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      timeZone: "Europe/Sofia",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const currentMinutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  const startMinutes = Math.floor(currentMinutes / 15) * 15;
  const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
  const format = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  return { endsAt: format(endMinutes), startsAt: format(startMinutes) };
}

function isUpcomingAppointment(appointment: Appointment, currentDateTimeKey: string) {
  if (["Отменена", "Завершена", "Не пришёл"].includes(appointment.status)) {
    return false;
  }

  const appointmentDateTimeKey = `${appointment.date}T${appointment.time.slice(0, 5)}:00`;
  return appointmentDateTimeKey > currentDateTimeKey;
}

function formatRussianCount(
  count: number,
  forms: { one: string; few: string; many: string },
) {
  const modulo100 = count % 100;
  const modulo10 = count % 10;
  const noun = modulo100 >= 11 && modulo100 <= 14
    ? forms.many
    : modulo10 === 1
      ? forms.one
      : modulo10 >= 2 && modulo10 <= 4
        ? forms.few
        : forms.many;

  return `${count} ${noun}`;
}

type AdminCalendarAction = "create";
export type AdminShellProps = {
  activeSection: AdminSectionId;
  actorUserId?: string;
  calendarAction?: AdminCalendarAction;
  initialData?: AdminShellInitialData;
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
type PriceFormState = {
  durationMinutes: string;
  note: string;
  order: string;
  priceEur: string;
  serviceSlug: string;
  status: PriceStatus;
  updatedAt: string;
};
type MediaFormState = {
  altText: string;
  dimensions: string;
  folder: string;
  name: string;
  publicationConsent: MediaPublicationConsent;
  size: string;
  status: MediaStatus;
  type: MediaType;
  uploadedAt: string;
  url: string;
  usage: string;
};
type ContactChannelFormState = {
  name: string;
  note: string;
  status: ContactStatus;
  type: ContactChannelType;
  usage: string;
  value: string;
};
type SettingsFormState = {
  auditLogRetentionDays: string;
  bookingCustomerEmailsEnabled: boolean;
  bookingBufferMinutes: string;
  businessName: string;
  cookiePrivacyMode: string;
  currency: "EUR";
  dailySlotCapacity: string;
  defaultLocale: string;
  defaultSeoTitle: string;
  emailSender: string;
  emailReviewUrl: string;
  googleCalendarId: string;
  googleCalendarMode: CalendarSyncMode;
  giftCertificatesEnabled: boolean;
  careEmailsEnabled: boolean;
  ownerNotificationEmail: string;
  ownerNotificationsEnabled: boolean;
  publicBookingDailyLimit: string;
  publicBookingEnabled: boolean;
  reminderTemplate: string;
  rolesPolicy: string;
  stripeMode: StripeMode;
  timezone: string;
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
const groupedNavigation = ["Операции", "Контент", "Финансы", "Система"] as const;
const clientFilterOptions = [
  { id: "all", label: "Все" },
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
const certificateStatusOptions: CertificateStatus[] = [
  "Оплачено",
  "Отправлен",
  "Ожидает PDF",
  "Погашен",
  "Возвращён",
];
const priceStatusOptions: PriceStatus[] = ["Активна", "Скрыта"];
const mediaTypeOptions: MediaType[] = ["Фото", "Документ"];
const contactChannelTypeOptions: ContactChannelType[] = ["Телефон", "Email", "Мессенджер", "Соцсеть", "Карта", "Бронирование"];
const reservedContactChannelTypes: Partial<Record<string, ContactChannelType>> = {
  "contact-email": "Email",
  "contact-map": "Карта",
  "contact-phone": "Телефон",
  "contact-studio24": "Бронирование",
};
const businessHoursDayLabels = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;
const contactStatusOptions: ContactStatus[] = ["Активен", "Черновик", "Скрыт"];
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
    status: "Готово",
    summary: "Транзакционные письма клиентам, уведомления Натали и письмо после визита.",
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
    publicationConsent: "not_required",
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
    publicationConsent: "not_required",
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
    publicationConsent: "not_required",
    size: "246 KB",
    status: "Готово",
    type: "Документ",
    uploadedAt: "2026-07-07",
    url: "/media/about/certificates/04-massage-therapist.webp",
    usage: ["О специалисте"],
  },
];
const initialContactSettings: ContactSettingsRecord = {
  address: businessFacts.address.display,
  bookingUrl: businessFacts.bookingUrl,
  businessName: businessFacts.name,
  email: businessFacts.email,
  mapUrl: businessMapUrls.search,
  phone: businessFacts.phone.display,
  seoArea: "Burgas, Bulgaria",
  workingHours: "Пн-Сб 10:00-19:00",
  workingSchedule: cloneBusinessHoursSchedule(defaultBusinessHoursSchedule),
};
const initialContactChannels: ContactChannelRecord[] = [
  {
    id: "contact-phone",
    name: "Телефон салона",
    note: "Основной номер для шапки, контактов, LocalBusiness schema и быстрых CTA.",
    status: "Активен",
    type: "Телефон",
    usage: ["Шапка сайта", "Контакты", "LocalBusiness SEO"],
    value: businessFacts.phone.display,
  },
  {
    id: "contact-email",
    name: "Email",
    note: "Публичный email для сертификатов, вопросов и административной связи.",
    status: "Активен",
    type: "Email",
    usage: ["Контакты", "Письма по сертификатам"],
    value: businessFacts.email,
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
    value: businessMapUrls.search,
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
    value: businessFacts.bookingUrl,
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
    translationKey: "blog-first-massage-preparation",
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
    translationKey: "blog-lymphatic-draft",
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
    translationKey: "blog-gift-certificate",
    updatedAt: "2026-07-07",
  },
];
const initialSettingsRecord: SettingsRecord = {
  auditLogRetentionDays: 180,
  blogEnabled: true,
  bookingCustomerEmailsEnabled: false,
  bookingBufferMinutes: 30,
  bookingHoldMinutes: 5,
  bookingHorizonDays: 60,
  bookingMinLeadMinutes: 30,
  bookingSlotStepMinutes: 30,
  businessName: businessFacts.name,
  cookiePrivacyMode: "Google Maps только после consent; Stripe только в оплате сертификата.",
  currency: "EUR",
  dailySlotCapacity: 8,
  defaultLocale: "bg",
  defaultSeoTitle: "Magic Massage Natali - массаж в Бургасе",
  emailSender: businessFacts.email,
  emailReviewUrl: "",
  googleCalendarId: "",
  googleCalendarMode: "Внутренний календарь главный",
  giftCertificatesEnabled: true,
  careEmailsEnabled: false,
  ownerNotificationEmail: "",
  ownerNotificationsEnabled: false,
  publicBookingDailyLimit: 8,
  publicBookingEnabled: false,
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

function cloneAdminDomainRecords(records: AdminDomainRecords): AdminDomainRecords {
  return {
    appointments: records.appointments.map((appointment) => ({ ...appointment })),
    calendarBlocks: (records.calendarBlocks ?? []).map((block) => ({ ...block })),
    certificates: records.certificates.map((certificate) => ({
      ...certificate,
      history: [...certificate.history],
    })),
    clients: records.clients.map((client) => ({
      ...client,
      history: client.history.map((visit) => ({ ...visit })),
      tags: [...client.tags],
    })),
    specialists: (records.specialists ?? []).map((specialist) => ({ ...specialist })),
  };
}

function buildInitialAdminRecords(initialData?: AdminShellInitialData) {
  const records =
    initialData?.records ??
    createAdminDemoRecords({
      appointmentRows: upcomingAppointments,
      certificateRows,
      clientRows,
      financeRows: demoFinanceRows,
    });

  return cloneAdminDomainRecords(records);
}

function buildInitialClientRows(records: AdminDomainRecords): ClientRecord[] {
  return records.clients;
}

function buildInitialCertificateRows(records: AdminDomainRecords): CertificateRecord[] {
  return records.certificates;
}

function buildInitialFinanceRows(initialData?: AdminShellInitialData): FinanceRow[] {
  return (initialData?.financeRows ?? demoFinanceRows).map((row) => ({ ...row }));
}

function buildInitialServiceRows(initialData?: AdminShellInitialData): ServiceRecord[] {
  return (initialData?.services ?? initialServiceRows).map((service) => ({
    ...service,
    locales: [...service.locales],
  }));
}

function buildInitialPriceRows(initialData?: AdminShellInitialData): PriceRecord[] {
  return (initialData?.prices ?? initialPriceRows).map((price) => ({ ...price }));
}

function buildInitialMediaRows(initialData?: AdminShellInitialData): MediaRecord[] {
  return (initialData?.media ?? initialMediaRows).map((item) => ({
    ...item,
    status: normalizeMediaStatus(item.status, item.altText),
    usage: [...item.usage],
  }));
}

function buildInitialContactChannels(initialData?: AdminShellInitialData): ContactChannelRecord[] {
  return (initialData?.contactChannels ?? initialContactChannels).map((channel) => ({
    ...channel,
    usage: [...channel.usage],
  }));
}

function buildInitialContactSettings(initialData?: AdminShellInitialData): ContactSettingsRecord {
  return { ...(initialData?.contactSettings ?? initialContactSettings) };
}

function buildInitialBlogPostRows(initialData?: AdminShellInitialData): BlogPostRecord[] {
  return (initialData?.blogPosts ?? initialBlogPostRows).map((post) => ({
    ...post,
    locales: [...post.locales],
    tags: [...post.tags],
  }));
}

function buildInitialSettingsRecord(initialData?: AdminShellInitialData): SettingsRecord {
  return { ...(initialData?.settings ?? initialSettingsRecord) };
}

function buildInitialAdminUsers(initialData?: AdminShellInitialData): AdminUserRecord[] {
  return (initialData?.adminUsers ?? initialAdminUserRows).map((user) => ({
    ...user,
    history: [...user.history],
  }));
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
    publicationConsent: media?.publicationConsent ?? "unknown",
    size: media?.size ?? "",
    status: media ? normalizeMediaStatus(media.status, media.altText) : "Черновик",
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
  return {
    ...settings,
    workingSchedule: cloneBusinessHoursSchedule(settings.workingSchedule),
  };
}

const blogEditorStatusByStatus: Record<BlogStatus, BlogEditorStatus> = {
  "На проверке": "review",
  Запланирована: "scheduled",
  Опубликована: "published",
  Черновик: "draft",
};

const blogStatusByEditorStatus: Record<BlogEditorStatus, BlogStatus> = {
  draft: "Черновик",
  published: "Опубликована",
  review: "На проверке",
  scheduled: "Запланирована",
};

function blogPostToEditorDraft(post?: BlogPostRecord): BlogArticleDraft {
  if (!post) return createEmptyBlogArticle("bg");

  return {
    author: post.author,
    canonicalUrl: post.canonicalUrl ?? `/${post.locales[0] ?? "bg"}/blog/${post.slug}`,
    category: post.category,
    content: post.body.startsWith("<") ? post.body : `<p>${post.body}</p>`,
    editorJson: post.editorJson ?? {},
    coverAlt: post.coverAlt ?? post.title,
    coverUrl: post.coverImage,
    excerpt: post.excerpt,
    hreflang: post.hreflang ?? {},
    locale: (post.locales[0] as BlogArticleDraft["locale"] | undefined) ?? "bg",
    ogDescription: post.ogDescription ?? post.excerpt,
    ogTitle: post.ogTitle ?? post.seoTitle,
    publishedAt: post.publishedAt,
    robotsDirectives: post.robotsDirectives ?? (post.status === "Опубликована" ? "index,follow" : "noindex,nofollow"),
    scheduledAt: post.status === "Запланирована" ? post.scheduledFor ?? "" : "",
    seoDescription: post.seoDescription ?? post.excerpt,
    seoTitle: post.seoTitle,
    slug: post.slug,
    status: blogEditorStatusByStatus[post.status],
    tags: [...post.tags],
    title: post.title,
    updatedAt: post.updatedAt,
  };
}

function editorDraftToBlogPost(
  draft: BlogArticleDraft,
  original?: BlogPostRecord,
  draftRecordId?: string,
  translationKey?: string,
): BlogPostRecord {
  const id = original?.id ?? draftRecordId ?? `blog-${crypto.randomUUID()}`;
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)
    ? draft.slug
    : `draft-${id.replace(/^blog-/, "").toLowerCase()}`;

  return {
    author: draft.author,
    body: draft.content,
    canonicalUrl: draft.canonicalUrl,
    category: draft.category,
    coverAlt: draft.coverAlt,
    coverImage: draft.coverUrl,
    editorJson: draft.editorJson,
    excerpt: draft.excerpt,
    hreflang: draft.hreflang,
    id,
    locales: [draft.locale],
    ogDescription: draft.ogDescription,
    ogTitle: draft.ogTitle,
    publishedAt: draft.scheduledAt.slice(0, 10) || draft.publishedAt || original?.publishedAt || getSofiaIsoDate(),
    robotsDirectives: draft.robotsDirectives,
    scheduledFor: draft.status === "scheduled" ? draft.scheduledAt : undefined,
    seoDescription: draft.seoDescription,
    seoTitle: draft.seoTitle,
    slug,
    status: blogStatusByEditorStatus[draft.status],
    tags: [...draft.tags],
    title: draft.title,
    translationKey: original?.translationKey ?? translationKey ?? id,
    updatedAt: getSofiaIsoDate(),
  };
}

function buildSettingsFormState(settings: SettingsRecord): SettingsFormState {
  return {
    auditLogRetentionDays: String(settings.auditLogRetentionDays),
    bookingCustomerEmailsEnabled: settings.bookingCustomerEmailsEnabled ?? false,
    bookingBufferMinutes: String(settings.bookingBufferMinutes),
    businessName: settings.businessName,
    cookiePrivacyMode: settings.cookiePrivacyMode,
    currency: settings.currency,
    dailySlotCapacity: String(settings.dailySlotCapacity),
    defaultLocale: settings.defaultLocale,
    defaultSeoTitle: settings.defaultSeoTitle,
    emailSender: settings.emailSender,
    emailReviewUrl: settings.emailReviewUrl ?? "",
    googleCalendarId: settings.googleCalendarId,
    googleCalendarMode: settings.googleCalendarMode,
    giftCertificatesEnabled: settings.giftCertificatesEnabled !== false,
    careEmailsEnabled: settings.careEmailsEnabled ?? false,
    ownerNotificationEmail: settings.ownerNotificationEmail ?? "",
    ownerNotificationsEnabled: settings.ownerNotificationsEnabled ?? false,
    publicBookingDailyLimit: String(settings.publicBookingDailyLimit ?? settings.dailySlotCapacity),
    publicBookingEnabled: settings.publicBookingEnabled ?? false,
    reminderTemplate: settings.reminderTemplate,
    rolesPolicy: settings.rolesPolicy,
    stripeMode: settings.stripeMode,
    timezone: settings.timezone,
  };
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

function createAdminUserId(name: string, email: string) {
  const base = normalizeSearch(email || name)
    .replace(/@/g, "-")
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return `admin-user-${base || "invite"}`;
}

function isSupabaseAuthUserId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function appointmentVisitLabel(appointment: Appointment) {
  return `${formatCalendarDay(appointment.date)}, ${appointment.time}`;
}

function findClientVisitAppointment(visit: ClientVisit, appointments: Appointment[]) {
  const normalizedVisitDate = normalizeSearch(visit.date);
  const normalizedVisitService = normalizeSearch(visit.service);

  return appointments.find(
    (appointment) =>
      normalizeSearch(appointment.service) === normalizedVisitService &&
      [
        appointmentVisitLabel(appointment),
        `${appointment.date} ${appointment.time.slice(0, 5)}`,
        `${appointment.date}T${appointment.time.slice(0, 5)}`,
      ].some((dateLabel) => normalizeSearch(dateLabel) === normalizedVisitDate),
  );
}

function findClientLastCompletedVisit(client: ClientRecord, appointments: Appointment[]) {
  const latestCompletedAppointment = sortAppointments(appointments)
    .filter((appointment) => appointment.status === "Завершена")
    .at(-1);

  if (latestCompletedAppointment) {
    return client.history.find(
      (visit) =>
        findClientVisitAppointment(visit, [latestCompletedAppointment]) === latestCompletedAppointment,
    ) ?? {
      date: `${latestCompletedAppointment.date} ${latestCompletedAppointment.time.slice(0, 5)}`,
      service: latestCompletedAppointment.service,
      status: latestCompletedAppointment.status,
    };
  }

  return client.history.find((visit) => normalizeSearch(visit.status).includes("заверш"));
}

function isCertificateInactive(status: CertificateStatus) {
  return status === "Погашен" || status === "Возвращён";
}

function findClientActiveCertificate(certificates: CertificateRecord[]) {
  return certificates.find((certificate) => !isCertificateInactive(certificate.status));
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

function buildInitialCalendarAppointments(records: AdminDomainRecords) {
  return records.appointments;
}

function buildInitialCalendarBlocks(records: AdminDomainRecords) {
  return records.calendarBlocks ?? [];
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

function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined" || typeof Blob === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }

  if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
    return;
  }

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
                disabled
                readOnly
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
              <select
                disabled={initialCertificate?.status === "Возвращён"}
                onChange={(event) => updateForm("status", event.target.value as CertificateStatus)}
                value={form.status}
              >
                {certificateStatusOptions.map((status) => (
                  <option disabled={status === "Возвращён"} key={status} value={status}>
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
  onSave: (media: MediaRecord, originalId?: string, cleanupPath?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<MediaFormState>(() => buildMediaFormState(initialMedia));
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File>();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const isEditing = Boolean(initialMedia);
  const readinessStatus = normalizeMediaStatus("Готово", form.altText);
  const mediaStatusOptions: MediaStatus[] = [readinessStatus, "Черновик"];

  function updateForm<Field extends keyof MediaFormState>(field: Field, value: MediaFormState[Field]) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "altText" && current.status !== "Черновик") {
        next.status = normalizeMediaStatus("Готово", String(value));
      }

      return next;
    });
    setError("");
  }

  async function uploadSelectedFile() {
    if (!selectedFile) return { url: form.url.trim() };

    setIsUploading(true);
    setUploadNotice("Загрузка файла...");

    try {
      const payload = new FormData();
      payload.set("file", selectedFile);
      payload.set("folder", form.folder);
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/media", {
        body: payload,
        headers: authorization ? { Authorization: authorization } : undefined,
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; mimeType?: string; path?: string; publicUrl?: string; size?: number }
        | null;

      if (!response.ok || !result?.publicUrl) {
        setError(result?.error ?? "Не удалось загрузить файл.");
        setUploadNotice("");
        return { url: "" };
      }

      updateForm("url", result.publicUrl);
      updateForm("size", `${result.size ?? selectedFile.size} B`);
      updateForm("type", result.mimeType === "application/pdf" ? "Документ" : "Фото");
      setUploadNotice("Файл загружен. Сохраните карточку медиа.");
      return { cleanupPath: result.path, url: result.publicUrl };
    } catch {
      setError("Не удалось загрузить файл.");
      setUploadNotice("");
      return { url: "" };
    } finally {
      setIsUploading(false);
    }
  }

  async function uploadNewMedia(request: MediaUploadRequest) {
    const payload = new FormData();
    payload.set("file", request.file);
    payload.set("folder", request.folder);
    const authorization = await getAdminAuthorizationHeader();
    const response = await fetch("/api/admin/media", {
      body: payload,
      headers: authorization ? { Authorization: authorization } : undefined,
      method: "POST",
    });
    const result = (await response.json().catch(() => null)) as
      | { error?: string; height?: number; mimeType?: string; path?: string; publicUrl?: string; size?: number; width?: number }
      | null;

    if (!response.ok || !result?.publicUrl) {
      throw new Error(result?.error ?? "Не удалось загрузить файл.");
    }

    await onSave({
      altText: request.altText,
      dimensions: result.width && result.height ? `${result.width}x${result.height}` : "",
      folder: request.folder,
      id: createMediaId(request.name, result.publicUrl),
      name: request.name,
      publicationConsent: request.publicationConsent,
      size: `${result.size ?? request.file.size} B`,
      status: "Готово",
      type: result.mimeType === "application/pdf" ? "Документ" : request.type,
      uploadedAt: new Date().toISOString().slice(0, 10),
      url: result.publicUrl,
      usage: [],
    }, undefined, result.path);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const upload = selectedFile ? await uploadSelectedFile() : { url: form.url.trim() };
    const url = upload.url;

    if (!name || !url) {
      setError("Укажите название и URL медиа.");
      return;
    }

    try {
      await onSave(
        {
        altText: form.altText.trim(),
        altTexts: initialMedia?.altTexts,
        dimensions: form.dimensions.trim(),
        folder: form.folder.trim() || "media",
        id: initialMedia?.id ?? createMediaId(name, url),
        name,
        placements: initialMedia?.placements,
        publicationConsent: form.publicationConsent,
        size: form.size.trim(),
        status: normalizeMediaStatus(form.status, form.altText),
        type: form.type,
        uploadedAt: form.uploadedAt,
        url,
        usage: parseCommaList(form.usage),
        },
        initialMedia?.id,
        upload.cleanupPath,
      );
    } catch (saveFailure) {
      setError(saveFailure instanceof Error ? saveFailure.message : "Не удалось сохранить медиа.");
    }
  }

  if (!initialMedia) {
    return (
      <div className="admin-action-backdrop">
        <section aria-labelledby="media-action-title" aria-modal="true" className="admin-action-dialog admin-media-form-dialog" role="dialog">
          <div className="admin-panel-head">
            <div>
              <span className="admin-kicker">Медиа</span>
              <h2 id="media-action-title">Новое медиа</h2>
            </div>
            <button className="admin-icon-button" onClick={onClose} type="button">Закрыть</button>
          </div>
          <div className="admin-action-body">
            <MediaUploader maxFileSizeBytes={10 * 1024 * 1024} onCancel={onClose} onUpload={uploadNewMedia} />
          </div>
        </section>
      </div>
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
              <select onChange={(event) => updateForm("folder", event.target.value)} value={form.folder}>
                {["services", "blog", "certificates", "gallery", "media"].map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" role="alert">
                {error}
              </p>
            ) : null}
            <label className="admin-form-wide">
              Файл до 10 MB
              <input
                accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0]);
                  setError("");
                }}
                type="file"
              />
            </label>
            {uploadNotice ? (
              <p className="admin-export-notice admin-form-alert-wide" role="status">
                {uploadNotice}
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
              Разрешение на публикацию
              <select
                onChange={(event) => updateForm("publicationConsent", event.target.value as MediaPublicationConsent)}
                value={form.publicationConsent}
              >
                <option value="unknown">Не проверено</option>
                <option value="granted">Разрешено</option>
                <option value="not_required">Не требуется</option>
                <option value="denied">Запрещено</option>
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
            <button disabled={isUploading} type="submit">
              {isUploading ? "Загрузка..." : isEditing ? "Сохранить изменения" : "Загрузить и сохранить"}
            </button>
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
  const phoneDigitCount = form.phone.replace(/\D/g, "").length;
  const hasInvalidPhone = (
    !/^\+?[0-9 ().-]{7,24}$/.test(form.phone.trim()) ||
    phoneDigitCount < 7 ||
    phoneDigitCount > 15
  );
  const hasInvalidSchedule = !isBusinessHoursSchedule(form.workingSchedule);

  function updateForm<Field extends keyof ContactSettingsRecord>(field: Field, value: ContactSettingsRecord[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function updateScheduleDay(weekday: number, patch: Partial<BusinessHoursDay>) {
    updateForm(
      "workingSchedule",
      form.workingSchedule.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !form.businessName.trim() ||
      hasInvalidPhone ||
      !form.address.trim() ||
      hasInvalidSchedule
    ) {
      setError("Укажите название, корректный телефон, адрес и график хотя бы с одним рабочим днём.");
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
      workingHours: formatBusinessHoursSummary(form.workingSchedule),
      workingSchedule: cloneBusinessHoursSchedule(form.workingSchedule),
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
                aria-describedby={error && hasInvalidPhone ? "contact-settings-error" : undefined}
                aria-invalid={error && hasInvalidPhone ? "true" : undefined}
                autoComplete="tel"
                onChange={(event) => updateForm("phone", event.target.value)}
                required
                type="tel"
                value={form.phone}
              />
            </label>
            {error ? (
              <p className="admin-form-alert admin-form-alert-wide" id="contact-settings-error" role="alert">
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
            <fieldset
              aria-describedby={error && hasInvalidSchedule ? "contact-settings-error" : undefined}
              aria-invalid={error && hasInvalidSchedule ? "true" : undefined}
              className="admin-business-hours-fieldset admin-form-wide"
            >
              <legend>График работы в футере</legend>
              <p>Отметьте рабочие дни и укажите время, которое будет показано на всех языковых версиях сайта.</p>
              <div className="admin-business-hours-list">
                {form.workingSchedule.map((day) => {
                  const dayLabel = businessHoursDayLabels[day.weekday - 1];

                  return (
                    <div className="admin-business-hours-row" key={day.weekday}>
                      <label className="admin-business-hours-toggle">
                        <input
                          aria-label={`${dayLabel}: рабочий день`}
                          checked={day.isOpen}
                          onChange={(event) => updateScheduleDay(day.weekday, { isOpen: event.target.checked })}
                          type="checkbox"
                        />
                        <span>{dayLabel}</span>
                      </label>
                      <label>
                        <span>Открытие</span>
                        <input
                          aria-label={`${dayLabel}: открытие`}
                          disabled={!day.isOpen}
                          onChange={(event) => updateScheduleDay(day.weekday, { opensAt: event.target.value })}
                          step={1800}
                          type="time"
                          value={day.opensAt}
                        />
                      </label>
                      <label>
                        <span>Закрытие</span>
                        <input
                          aria-label={`${dayLabel}: закрытие`}
                          disabled={!day.isOpen}
                          onChange={(event) => updateScheduleDay(day.weekday, { closesAt: event.target.value })}
                          step={1800}
                          type="time"
                          value={day.closesAt}
                        />
                      </label>
                      {!day.isOpen ? <span className="admin-business-hours-closed">Выходной</span> : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
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
  const reservedType = initialChannel ? reservedContactChannelTypes[initialChannel.id] : undefined;
  const phoneDigitCount = form.value.replace(/\D/g, "").length;
  const hasInvalidPhone = form.type === "Телефон" && (
    !/^\+?[0-9 ().-]{7,24}$/.test(form.value.trim()) ||
    phoneDigitCount < 7 ||
    phoneDigitCount > 15
  );
  const hasInvalidEmail = form.type === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.trim());
  const hasInvalidUrl = (form.type === "Карта" || form.type === "Бронирование") && (() => {
    try {
      const url = new URL(form.value.trim());
      return url.protocol !== "http:" && url.protocol !== "https:";
    } catch {
      return true;
    }
  })();
  const hasInvalidTypedValue = hasInvalidPhone || hasInvalidEmail || hasInvalidUrl;

  function updateForm<Field extends keyof ContactChannelFormState>(field: Field, value: ContactChannelFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const value = form.value.trim();

    if (!name || !value || hasInvalidTypedValue) {
      setError(
        hasInvalidPhone
          ? "Укажите корректный номер телефона."
          : hasInvalidEmail
            ? "Укажите корректный email."
            : hasInvalidUrl
              ? "Укажите ссылку, которая начинается с http:// или https://."
              : "Укажите название и значение контакта.",
      );
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
              <select
                disabled={Boolean(reservedType)}
                onChange={(event) => updateForm("type", event.target.value as ContactChannelType)}
                value={form.type}
              >
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
                aria-invalid={error && (!form.value.trim() || hasInvalidTypedValue) ? "true" : undefined}
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

function SettingsCancelButton({ onClose }: { onClose: () => void }) {
  const requestClose = useAdminDrawerClose() ?? onClose;

  return <button className="admin-secondary-button" onClick={requestClose} type="button">Отмена</button>;
}

function isValidHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
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
  const auditLogRetentionRef = useRef<HTMLInputElement>(null);
  const businessNameRef = useRef<HTMLInputElement>(null);
  const ownerNotificationEmailRef = useRef<HTMLInputElement>(null);
  const publicBookingDailyLimitRef = useRef<HTMLInputElement>(null);
  const reviewUrlRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [initialForm] = useState<SettingsFormState>(() => buildSettingsFormState(settings));
  const [form, setForm] = useState<SettingsFormState>(initialForm);
  const [error, setError] = useState("");
  const hasUnsavedChanges = (Object.keys(initialForm) as Array<keyof SettingsFormState>)
    .some((field) => form[field] !== initialForm[field]);

  function updateForm<Field extends keyof SettingsFormState>(field: Field, value: SettingsFormState[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const bookingBufferMinutes = Number(form.bookingBufferMinutes);
    const publicBookingDailyLimit = Number(form.publicBookingDailyLimit);
    const auditLogRetentionDays = Number(form.auditLogRetentionDays);
    const hasInvalidAuditRetention = !isPositiveInteger(auditLogRetentionDays);
    const hasInvalidBusinessName = !form.businessName.trim();
    const hasInvalidOwnerEmail = form.ownerNotificationsEnabled && !isValidEmail(form.ownerNotificationEmail.trim());
    const hasInvalidPublicLimit = !isPositiveInteger(publicBookingDailyLimit) || publicBookingDailyLimit > 8;
    const hasInvalidReviewUrl = form.careEmailsEnabled && !isValidHttpsUrl(form.emailReviewUrl.trim());

    if (
      hasInvalidBusinessName ||
      hasInvalidOwnerEmail ||
      ![15, 30].includes(bookingBufferMinutes) ||
      hasInvalidPublicLimit ||
      hasInvalidAuditRetention ||
      hasInvalidReviewUrl
    ) {
      setError(
        hasInvalidOwnerEmail
          ? "Чтобы включить письма Натали, укажите корректный email получателя."
          : hasInvalidReviewUrl
            ? "Чтобы включить письмо после визита, укажите публичную HTTPS-ссылку для отзыва."
            : "Укажите название, буфер 15 или 30 минут, публичный лимит до 8 записей и срок хранения audit log.",
      );
      const firstInvalidField = hasInvalidBusinessName
        ? businessNameRef.current
        : hasInvalidPublicLimit
          ? publicBookingDailyLimitRef.current
          : hasInvalidOwnerEmail
            ? ownerNotificationEmailRef.current
            : hasInvalidReviewUrl
              ? reviewUrlRef.current
          : hasInvalidAuditRetention
            ? auditLogRetentionRef.current
            : null;
      firstInvalidField?.focus();
      firstInvalidField?.scrollIntoView?.({ block: "center" });
      return;
    }

    onSave({
      auditLogRetentionDays,
      blogEnabled: settings.blogEnabled !== false,
      bookingCustomerEmailsEnabled: form.bookingCustomerEmailsEnabled,
      bookingBufferMinutes,
      bookingHoldMinutes: settings.bookingHoldMinutes ?? 5,
      bookingHorizonDays: settings.bookingHorizonDays ?? 60,
      bookingMinLeadMinutes: settings.bookingMinLeadMinutes ?? 30,
      bookingSlotStepMinutes: settings.bookingSlotStepMinutes ?? 30,
      businessName: form.businessName.trim(),
      cookiePrivacyMode: form.cookiePrivacyMode.trim(),
      currency: form.currency,
      dailySlotCapacity: publicBookingDailyLimit,
      defaultLocale: form.defaultLocale,
      defaultSeoTitle: form.defaultSeoTitle.trim(),
      emailSender: form.emailSender.trim(),
      emailReviewUrl: form.emailReviewUrl.trim(),
      googleCalendarId: form.googleCalendarId.trim(),
      googleCalendarMode: form.googleCalendarMode,
      giftCertificatesEnabled: form.giftCertificatesEnabled,
      careEmailsEnabled: form.careEmailsEnabled,
      ownerNotificationEmail: form.ownerNotificationEmail.trim(),
      ownerNotificationsEnabled: form.ownerNotificationsEnabled,
      publicBookingDailyLimit,
      publicBookingEnabled: form.publicBookingEnabled,
      reminderTemplate: form.reminderTemplate.trim(),
      rolesPolicy: form.rolesPolicy.trim(),
      stripeMode: form.stripeMode,
      timezone: form.timezone.trim(),
      updatedAt: getSofiaIsoDate(),
      workingDays: settings.workingDays,
      workingHours: settings.workingHours,
    });
  }

  return (
    <AdminDrawer
      ariaLabelledBy="settings-action-title"
      className="admin-settings-drawer"
      hasUnsavedChanges={hasUnsavedChanges}
      initialFocusRef={titleRef}
      onClose={onClose}
    >
      <form autoComplete="off" className="admin-drawer-form" noValidate onSubmit={handleSubmit}>
        <AdminDrawerHeader
          kicker="Настройки"
          onClose={onClose}
          title="Настройки админки"
          titleId="settings-action-title"
          titleRef={titleRef}
          titleTabIndex={-1}
        />
        <AdminDrawerBody>
          <div className="admin-action-body admin-content-form-grid admin-settings-form-grid">
            <label>
              Название бизнеса
              <input
                aria-describedby={error && !form.businessName.trim() ? "settings-form-error" : undefined}
                aria-invalid={error && !form.businessName.trim() ? "true" : undefined}
                autoComplete="off"
                onChange={(event) => updateForm("businessName", event.target.value)}
                ref={businessNameRef}
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
              <p className="admin-form-alert admin-form-alert-wide" id="settings-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <label>
              Часовой пояс
              <input autoComplete="off" onChange={(event) => updateForm("timezone", event.target.value)} type="text" value={form.timezone} />
            </label>
            <div className="admin-form-readonly admin-form-wide" aria-label="График специалистов">
              <span>График специалистов</span>
              <strong>Изменяется в календаре отдельно для каждого специалиста</strong>
            </div>
            <fieldset className="admin-settings-choice">
              <legend>Перерыв между сеансами</legend>
              <div className="admin-filter-row" aria-label="Перерыв между сеансами">
                {[15, 30].map((minutes) => (
                  <button
                    aria-pressed={form.bookingBufferMinutes === String(minutes)}
                    key={minutes}
                    onClick={() => updateForm("bookingBufferMinutes", String(minutes))}
                    type="button"
                  >
                    {minutes} минут
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              Лимит онлайн-записей в день
              <input
                aria-describedby={
                  error && (!isPositiveInteger(Number(form.publicBookingDailyLimit)) || Number(form.publicBookingDailyLimit) > 8)
                    ? "settings-form-error"
                    : undefined
                }
                aria-invalid={
                  error &&
                  (!isPositiveInteger(Number(form.publicBookingDailyLimit)) || Number(form.publicBookingDailyLimit) > 8)
                    ? "true"
                    : undefined
                }
                max={8}
                min={1}
                onChange={(event) => updateForm("publicBookingDailyLimit", event.target.value)}
                ref={publicBookingDailyLimitRef}
                required
                step={1}
                type="number"
                value={form.publicBookingDailyLimit}
              />
            </label>
            <label className="admin-checkbox-field admin-form-wide">
              <input
                checked={form.publicBookingEnabled}
                onChange={(event) => updateForm("publicBookingEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Публичная онлайн-запись включена</span>
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
              <input autoComplete="off" onChange={(event) => updateForm("googleCalendarId", event.target.value)} type="text" value={form.googleCalendarId} />
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
            <label className="admin-checkbox-field admin-form-wide">
              <input
                checked={form.giftCertificatesEnabled}
                onChange={(event) => updateForm("giftCertificatesEnabled", event.target.checked)}
                type="checkbox"
              />
              <span>Показывать подарочные сертификаты на публичном сайте</span>
            </label>
            <fieldset className="admin-form-section admin-form-wide admin-email-settings-section">
              <legend>Email-уведомления</legend>
              <p className="admin-form-helper">
                Все новые типы писем по умолчанию выключены. Включайте их после проверки домена Resend и тестовой отправки.
              </p>
              <label className="admin-checkbox-field admin-form-wide">
                <input
                  checked={form.bookingCustomerEmailsEnabled}
                  onChange={(event) => updateForm("bookingCustomerEmailsEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span>Письма клиентам о записях</span>
              </label>
              <label className="admin-checkbox-field admin-form-wide">
                <input
                  checked={form.ownerNotificationsEnabled}
                  onChange={(event) => updateForm("ownerNotificationsEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span>Письма Натали о новых онлайн-записях и сертификатах</span>
              </label>
              <label>
                Email Натали для уведомлений
                <input
                  aria-describedby="settings-owner-email-helper"
                  aria-invalid={error && form.ownerNotificationsEnabled && !isValidEmail(form.ownerNotificationEmail.trim()) ? "true" : undefined}
                  autoComplete="email"
                  onChange={(event) => updateForm("ownerNotificationEmail", event.target.value)}
                  ref={ownerNotificationEmailRef}
                  type="email"
                  value={form.ownerNotificationEmail}
                />
              </label>
              <p className="admin-form-helper" id="settings-owner-email-helper">
                Обязателен только при включённых внутренних уведомлениях. Контакты и заметки клиента в эти письма не попадают.
              </p>
              <label className="admin-checkbox-field admin-form-wide">
                <input
                  aria-describedby="settings-care-email-helper"
                  checked={form.careEmailsEnabled}
                  onChange={(event) => updateForm("careEmailsEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span>Письмо после визита клиентам с отдельным согласием</span>
              </label>
              <p className="admin-form-helper" id="settings-care-email-helper">
                Отправляется на следующий день в 10:00 Europe/Sofia. Скидки и массовые рассылки не используются.
              </p>
              <label>
                HTTPS-ссылка для отзыва
                <input
                  aria-describedby="settings-review-url-helper"
                  aria-invalid={error && form.careEmailsEnabled && !isValidHttpsUrl(form.emailReviewUrl.trim()) ? "true" : undefined}
                  autoComplete="url"
                  onChange={(event) => updateForm("emailReviewUrl", event.target.value)}
                  ref={reviewUrlRef}
                  type="url"
                  value={form.emailReviewUrl}
                />
              </label>
              <p className="admin-form-helper" id="settings-review-url-helper">
                Нужна валидная публичная HTTPS-ссылка. Без неё письма после визита нельзя включить.
              </p>
              <div className="admin-form-readonly admin-form-wide" aria-label="Проверенный отправитель">
                <span>Отправитель</span>
                <strong>{settings.verifiedEmailSender || "RESEND_FROM_EMAIL не настроен"}</strong>
                <small>Берётся из проверенного RESEND_FROM_EMAIL и не редактируется в админке.</small>
              </div>
              <div className="admin-form-readonly admin-form-wide" aria-label="Расписание email-уведомлений">
                <span>Фиксированное расписание</span>
                <strong>Подтверждение: до 5 минут · перенос: через 2 минуты · напоминание: за 24 часа</strong>
              </div>
              <EmailTemplatePreview />
            </fieldset>
            <label>
              Хранение audit log
              <input
                aria-describedby={error && !isPositiveInteger(Number(form.auditLogRetentionDays)) ? "settings-form-error" : undefined}
                aria-invalid={error && !isPositiveInteger(Number(form.auditLogRetentionDays)) ? "true" : undefined}
                min={1}
                onChange={(event) => updateForm("auditLogRetentionDays", event.target.value)}
                ref={auditLogRetentionRef}
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
              Политика ролей
              <textarea onChange={(event) => updateForm("rolesPolicy", event.target.value)} rows={3} value={form.rolesPolicy} />
            </label>
          </div>
        </AdminDrawerBody>
        <AdminDrawerFooter>
          <button className="admin-primary-button" type="submit">Сохранить настройки</button>
          <SettingsCancelButton onClose={onClose} />
        </AdminDrawerFooter>
      </form>
    </AdminDrawer>
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

function DashboardWorkspace({
  appointments,
  certificates,
  clients,
  financeRows,
  hasLoadError,
  onSaveAppointment,
  query,
  role,
  timeZone,
}: {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  financeRows: FinanceRow[];
  hasLoadError: boolean;
  onSaveAppointment: (
    appointment: Appointment,
    action?: AdminAuditAction,
    originalAppointment?: Appointment,
  ) => Promise<CalendarAppointmentSaveResult>;
  query: string;
  role: AdminRoleId;
  timeZone: string;
}) {
  const currentDateTimeKey = getLocalDateTimeKey(new Date(), timeZone);
  const currentDate = currentDateTimeKey.slice(0, 10);
  const filteredAppointments = sortAppointments(
    appointments.filter(
      (appointment) =>
        isUpcomingAppointment(appointment, currentDateTimeKey) &&
        matchesSearch([appointment.time, appointment.client, appointment.service, appointment.status], query),
    ),
  );
  const filteredCertificates = certificates.filter((certificate) =>
    matchesSearch([certificate.code, certificate.buyer, certificate.clientName, certificate.recipient, certificate.status], query),
  );
  const isSpecialist = role === "specialist";
  const canManagePostVisitComments = role === "owner" || role === "administrator";
  const canViewOperationalMetrics = role === "owner" || role === "administrator" || role === "viewer";
  const canViewFinancialMetrics = role === "owner" || role === "administrator";
  const todayAppointmentCount = appointments.filter(
    (appointment) => appointment.date === currentDate && appointment.status !== "Отменена",
  ).length;
  const pendingAppointmentCount = appointments.filter(
    (appointment) => appointment.status === "Ожидает" || appointment.status === "Новая заявка",
  ).length;
  const paidCertificateCount = certificates.filter(
    (certificate) => certificate.status !== "Возвращён" && Boolean(certificate.paymentDate.trim()),
  ).length;
  const financeSummary = calculateFinanceSummary(financeRows);
  const operationalMetrics = [
    {
      label: "Сегодня",
      tone: "info",
      value: formatRussianCount(todayAppointmentCount, {
        few: "записи",
        many: "записей",
        one: "запись",
      }),
    },
    {
      label: "Ждут подтверждения",
      tone: "warning",
      value: formatRussianCount(pendingAppointmentCount, {
        few: "заявки",
        many: "заявок",
        one: "заявка",
      }),
    },
    { label: "Сертификаты", tone: "success", value: `${paidCertificateCount} оплачено` },
  ];
  const visibleMetrics = isSpecialist
    ? [
        { label: "Мои записи", tone: "primary", value: String(appointments.length) },
        {
          label: "Подтверждены",
          tone: "success",
          value: String(appointments.filter((appointment) => appointment.status === "Подтверждена").length),
        },
      ]
    : canViewOperationalMetrics
      ? [
          ...operationalMetrics,
          ...(canViewFinancialMetrics
            ? [{ label: "Stripe за месяц", tone: "neutral", value: formatCurrency(financeSummary.gross) }]
            : []),
        ]
      : [];

  return (
    <div className="admin-dashboard-grid">
      {visibleMetrics.length > 0 ? <section className="admin-metric-row" aria-label="Ключевые показатели">
        {visibleMetrics.map((metric) => (
          <article className={`admin-metric admin-metric-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section> : null}

      {canManagePostVisitComments ? (
        <PostVisitCommentQueue
          appointments={appointments}
          clients={clients}
          hasLoadError={hasLoadError}
          onSaveComment={(appointment, originalAppointment) =>
            onSaveAppointment(
              appointment,
              "appointment.post_visit_comment",
              originalAppointment,
            )
          }
          query={query}
          role={role}
        />
      ) : null}

      <section className="admin-panel admin-panel-large" aria-labelledby="appointments-heading">
        <div className="admin-panel-head">
          <h2 id="appointments-heading">Ближайшие записи</h2>
          <Link className="admin-text-action" href={`/admin?section=calendar&role=${role}`} prefetch={false}>
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
                      {isSpecialist ? (
                        appointment.client
                      ) : (
                        <Link className="admin-row-action admin-row-link" href={clientProfileHref(appointmentClientIdentity, role)} prefetch={false}>
                          {appointment.client}
                        </Link>
                      )}
                    </td>
                    <td>{appointment.service}</td>
                    <td>
                      <span className={statusClass(appointment.status)}>{appointment.status}</span>
                    </td>
                    <td>
                      <Link className="admin-row-action admin-row-link" href={calendarAppointmentHref(appointment, role, appointmentClientIdentity)} prefetch={false}>
                        Календарь
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAppointments.length === 0 ? (
          <EmptyState
            label={query.trim() ? "Среди будущих записей ничего не найдено." : "Будущих записей пока нет."}
          />
        ) : null}
      </section>

      {!isSpecialist ? <section className="admin-panel" aria-labelledby="certificate-heading">
        <div className="admin-panel-head">
          <h2 id="certificate-heading">Сертификаты</h2>
          <Link className="admin-text-action" href={`/admin?section=certificates&role=${role}`} prefetch={false}>
            Все
          </Link>
        </div>
        <div className="admin-list">
          {filteredCertificates.map((certificate) => (
            <article className="admin-list-item" key={certificate.code}>
              <div>
                <strong>
                  <Link className="admin-row-action admin-row-link" href={certificateDetailHref(certificate.code, role)} prefetch={false}>
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
      </section> : null}

    </div>
  );
}

function ClientDetailCard({
  appointments,
  certificates,
  client,
  onCalendarCreateIntent,
  onClose,
  onDeleteClient,
  onEditClient,
  onIssueCertificate,
  onSaveAppointment,
  onSaveNote,
  role,
  timeZone,
}: {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  client: ClientRecord;
  onCalendarCreateIntent: () => void;
  onClose: () => void;
  onDeleteClient: (client: ClientRecord) => void;
  onEditClient: (client: ClientRecord) => void;
  onIssueCertificate: (client: ClientRecord) => void;
  onSaveAppointment: (appointment: Appointment) => Promise<CalendarAppointmentSaveResult>;
  onSaveNote: (clientId: string, note: string) => void;
  role: AdminRoleId;
  timeZone: string;
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [activeFeedFilter, setActiveFeedFilter] = useState<ClientFeedFilterId>("all");
  const [draftNote, setDraftNote] = useState(client.note);
  const [saveNotice, setSaveNotice] = useState("");
  const [editingVisitKey, setEditingVisitKey] = useState("");
  const [isVisitCommentDirty, setIsVisitCommentDirty] = useState(false);
  const clientInitials = client.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const nextAppointment = findNextClientAppointment(
    appointments,
    getLocalDateTimeKey(new Date(), timeZone),
  );
  const lastCompletedVisit = findClientLastCompletedVisit(client, appointments);
  const activeCertificate = findClientActiveCertificate(certificates);
  const nextClientAction = buildClientNextAction(client, nextAppointment, activeCertificate, role);
  const shouldShowVisits = activeFeedFilter === "all" || activeFeedFilter === "visits";
  const shouldShowCertificates = activeFeedFilter === "all" || activeFeedFilter === "certificates";
  const shouldShowNotes = activeFeedFilter === "all" || activeFeedFilter === "notes";
  const hasVisibleFeedItems =
    (shouldShowVisits && client.history.length > 0) ||
    (shouldShowCertificates && certificates.length > 0) ||
    (shouldShowNotes && Boolean(client.note));
  const hasCareEmailConsent = Boolean(client.careEmailConsentAt && !client.careEmailWithdrawnAt);

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
    <ClientDetail
      client={client}
      hasUnsavedChanges={
        (isEditingNote && draftNote.trim() !== client.note.trim()) || isVisitCommentDirty
      }
      onClose={onClose}
    >
        <AdminDrawerSection title="Профиль и статус">
          <div className="admin-client-profile-head">
            <span className="admin-client-avatar" aria-hidden="true">
              {clientInitials}
            </span>
            <div>
              <strong>{client.name}</strong>
              <small>{client.language.toUpperCase()}</small>
              <span className={statusClass(client.status)}>{client.status}</span>
            </div>
          </div>
        </AdminDrawerSection>

        <AdminDrawerSection title="Контактные данные">
          <ClientContacts client={client} />
        </AdminDrawerSection>

        {role === "owner" || role === "administrator" ? (
          <AdminDrawerSection title="Email после визита">
            <div className="admin-client-consent-status">
              <span className="admin-email-status" data-status={hasCareEmailConsent ? "delivered" : "blocked"}>
                {hasCareEmailConsent ? "Согласие зафиксировано" : "Согласия нет"}
              </span>
              <p>
                {hasCareEmailConsent
                  ? `Источник: ${client.careEmailConsentSource === "public_booking" ? "онлайн-запись" : "администратор"}.`
                  : "Письмо после визита не будет отправлено без отдельного явного согласия клиента."}
              </p>
              <button className="admin-outline-action" onClick={() => onEditClient(client)} type="button">
                Изменить согласие
              </button>
            </div>
          </AdminDrawerSection>
        ) : null}

        <AdminDrawerSection title="Быстрые действия">
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
            {client.phone ? (
              <a className="admin-outline-action" href={phoneHref(client.phone)}>
                Позвонить
              </a>
            ) : null}
            {client.email ? (
              <a className="admin-outline-action" href={`mailto:${client.email}`}>
                Email
              </a>
            ) : null}
            {client.telegram ? (
              <a className="admin-outline-action" href={client.telegram} rel="noreferrer" target="_blank">
                Telegram
              </a>
            ) : null}
          </div>
        </AdminDrawerSection>

        <AdminDrawerSection title="Ключевые показатели">
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
        </AdminDrawerSection>

      <AdminDrawerSection ariaLabel="Следующее действие клиента" className="admin-client-next-action">
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
      </AdminDrawerSection>

      <AdminDrawerSection ariaLabel="Рабочий профиль клиента" className="admin-client-work-profile">
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
      </AdminDrawerSection>

      <AdminDrawerSection ariaLabel="Рабочая лента клиента" className="admin-client-activity-feed">
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
                        {linkedAppointment?.postVisitComment ? <small>{linkedAppointment.postVisitComment}</small> : null}
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
      </AdminDrawerSection>

      <AdminDrawerSection ariaLabel="Ближайшая запись клиента" className="admin-client-next-appointment">
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
      </AdminDrawerSection>

      <AdminDrawerSection title="История визитов">
        <ClientVisitHistory
          clientId={client.id}
          editingVisitKey={editingVisitKey}
          items={client.history.map((visit) => ({
            appointment: findClientVisitAppointment(visit, appointments),
            visit,
          }))}
          onCommentDirtyChange={setIsVisitCommentDirty}
          onEditVisit={setEditingVisitKey}
          onSaveComment={onSaveAppointment}
          role={role}
        />
      </AdminDrawerSection>

      <AdminDrawerSection title="Сертификаты">
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
      </AdminDrawerSection>

      <AdminDrawerSection>
        <ClientNotes
          draftNote={draftNote}
          isEditing={isEditingNote}
          note={client.note}
          onCancel={cancelNoteEdit}
          onChange={setDraftNote}
          onEdit={startNoteEdit}
          onSubmit={handleNoteSubmit}
          saveNotice={saveNotice}
        />
      </AdminDrawerSection>
      <AdminDrawerSection title="Теги">
        <div className="admin-client-tags" aria-label="Теги клиента">
          {client.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </AdminDrawerSection>
      {role === "owner" || role === "administrator" ? (
        <AdminDrawerSection
          className="admin-danger-zone"
          description="Профиль можно удалить только после удаления всех связанных записей."
          title="Опасная зона"
        >
          <button className="admin-danger-button" onClick={() => onDeleteClient(client)} type="button">
            Удалить клиента
          </button>
        </AdminDrawerSection>
      ) : null}
    </ClientDetail>
  );
}

function ClientsWorkspace({
  appointments,
  certificates,
  clients,
  isClientCreateOpen,
  onCalendarCreateIntent,
  onCloseClientCreate,
  onDeleteClient,
  onSaveCertificate,
  onSaveAppointment,
  onSaveClient,
  onSaveClientNote,
  query,
  role,
  selectedClientName,
  timeZone,
}: {
  appointments: Appointment[];
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  isClientCreateOpen: boolean;
  onCalendarCreateIntent: () => void;
  onCloseClientCreate: () => void;
  onDeleteClient: (client: ClientRecord) => Promise<CalendarAppointmentSaveResult>;
  onSaveCertificate: (certificate: CertificateRecord, originalCode?: string) => void;
  onSaveAppointment: (
    appointment: Appointment,
    action?: AdminAuditAction,
    originalAppointment?: Appointment,
  ) => Promise<CalendarAppointmentSaveResult>;
  onSaveClient: (client: ClientRecord, originalClientIdentity?: string) => void;
  onSaveClientNote: (clientIdentity: string, note: string) => void;
  query: string;
  role: AdminRoleId;
  selectedClientName?: string;
  timeZone: string;
}) {
  const initialSelectedClientKey = findClientByIdentity(clients, selectedClientName)?.id ?? clients[0]?.id ?? "";
  const [selectedClientKey, setSelectedClientKey] = useState(initialSelectedClientKey);
  const [isClientDrawerOpen, setIsClientDrawerOpen] = useState(Boolean(selectedClientName));
  const [editingClient, setEditingClient] = useState<ClientRecord | undefined>();
  const [certificateDraft, setCertificateDraft] = useState<CertificateRecord | undefined>();
  const [deletingClient, setDeletingClient] = useState<ClientRecord | undefined>();
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
  const deletingClientAppointments = deletingClient
    ? findClientAppointments(appointments, deletingClient, clients)
    : [];
  const deletingClientCertificates = deletingClient
    ? findClientCertificates(certificates, deletingClient, clients)
    : [];
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

  async function deleteSelectedClient(client: ClientRecord) {
    const result = await onDeleteClient(client);
    if (!result.ok) return result;

    setIsClientDrawerOpen(false);
    setSelectedClientKey(clients.find((candidate) => candidate.id !== client.id)?.id ?? "");
    return result;
  }

  if (!selectedClient) {
    return (
      <>
        <EmptyState label="Клиенты не найдены." />
        {isClientFormOpen ? (
          <ClientForm
            clients={clients}
            key="client-form-new"
            onClose={closeClientForm}
            onSave={saveClientForm}
            role={role}
          />
        ) : null}
      </>
    );
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
                <th>Следующий визит</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
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
                  <td>{client.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul aria-label="Мобильный список клиентов" className="admin-mobile-client-list">
          {filteredClients.map((client) => (
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
                <span className="admin-mobile-client-foot">
                  <span className={statusClass(client.status)}>{client.status}</span>
                  <span>{client.next}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {filteredClients.length === 0 ? <EmptyState label="Клиенты не найдены." /> : null}
      </section>

      {isClientDrawerOpen ? (
        <ClientDetailCard
          appointments={selectedClientAppointments}
          certificates={selectedClientCertificates}
          key={`client-detail-${selectedClient.id}`}
          client={selectedClient}
          onCalendarCreateIntent={onCalendarCreateIntent}
          onClose={() => setIsClientDrawerOpen(false)}
          onDeleteClient={setDeletingClient}
          onEditClient={openClientEdit}
          onIssueCertificate={openClientCertificateDraft}
          onSaveAppointment={(appointment) => onSaveAppointment(appointment, "appointment.post_visit_comment")}
          onSaveNote={onSaveClientNote}
          role={role}
          timeZone={timeZone}
        />
      ) : null}
      {isClientFormOpen ? (
          <ClientForm
            clients={clients}
            initialClient={editingClient}
            key={editingClient ? `client-form-${editingClient.id}` : "client-form-new"}
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
      {deletingClient ? (
        <AdminRecordDeleteDialog
          blockedReason={deletingClientAppointments.length > 0
            ? `У клиента есть ${deletingClientAppointments.length} записей. Сначала удалите их из календаря.`
            : undefined}
          confirmLabel="Удалить клиента"
          confirmationText={deletingClient.name}
          description="Профиль будет удалён без возможности восстановления. Связанные сертификаты сохранятся без привязки к профилю."
          kicker="Клиенты"
          onClose={() => setDeletingClient(undefined)}
          onConfirm={() => deleteSelectedClient(deletingClient)}
          subject={deletingClient.name}
          summaryItems={[
            deletingClient.phone || "Телефон не указан",
            `${deletingClientAppointments.length} записей`,
            `${deletingClientCertificates.length} сертификатов`,
          ]}
          title="Удалить клиента?"
        />
      ) : null}
    </div>
  );
}

function AdminDetailDrawer({
  ariaLabel,
  children,
  className = "",
  kicker,
  onClose,
  subtitle,
  title,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  kicker: string;
  onClose: () => void;
  subtitle?: string;
  title: string;
}) {
  const drawerClassName = ["admin-detail-panel", className].filter(Boolean).join(" ");
  const titleId = `admin-detail-drawer-${ariaLabel.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <AdminDrawer ariaLabel={ariaLabel} className={drawerClassName} onClose={onClose}>
      <AdminDrawerHeader kicker={kicker} onClose={onClose} title={title} titleId={titleId}>
        {subtitle ? <p>{subtitle}</p> : null}
      </AdminDrawerHeader>
      <AdminDrawerBody>
        {children}
      </AdminDrawerBody>
    </AdminDrawer>
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
  showGiftReconciliation,
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
  showGiftReconciliation: boolean;
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
        {showGiftReconciliation ? <GiftCertificateReconciliationList role={role} /> : null}
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

        {showGiftReconciliation ? <GiftCertificateReconciliationList role={role} /> : null}

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
        <AdminDetailDrawer
          ariaLabel="Детали сертификата"
          kicker="Сертификат"
          onClose={() => setIsCertificateDrawerOpen(false)}
          subtitle={`${selectedCertificate.buyer} → ${selectedCertificate.recipient} · ${selectedCertificate.status}`}
          title={selectedCertificate.code}
        >
        <div className="admin-detail-heading">
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
              disabled={selectedCertificate.status === "Отправлен" || isCertificateInactive(selectedCertificate.status)}
              onClick={() => setCertificateStatus("Отправлен", "PDF отмечен как отправленный.")}
              type="button"
            >
              Отправить PDF
            </button>
            <button
              className="admin-danger-button"
              disabled={isCertificateInactive(selectedCertificate.status)}
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

        {role === "owner" || role === "administrator" ? (
          <section className="admin-client-section" aria-labelledby="certificate-email-status-title">
            <h3 id="certificate-email-status-title">Email-уведомления</h3>
            <EmailNotificationStatusList aggregateId={selectedCertificate.code} aggregateType="certificate" />
          </section>
        ) : null}

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
    setIsServiceDrawerOpen(false);
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
          <ServiceEditor
            initialService={editingService}
            key={editingService?.slug ?? "new-service"}
            onClose={closeServiceForm}
            onSave={saveServiceForm}
            suggestedOrder={services.length + 1}
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

        <ServiceList
          onOpen={openService}
          onSave={onSaveService}
          role={role}
          selectedSlug={isServiceDrawerOpen ? selectedService.slug : undefined}
          services={filteredServices}
        />
        {filteredServices.length === 0 ? <EmptyState label="Услуги не найдены." /> : null}
      </section>

      {isServiceDrawerOpen ? (
        <AdminDetailDrawer
          ariaLabel="Детали услуги"
          kicker="Услуга"
          onClose={() => setIsServiceDrawerOpen(false)}
          subtitle={`${selectedService.slug} · ${selectedService.status}`}
          title={selectedService.name}
        >
        <div className="admin-detail-heading">
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
        <ServiceEditor
          initialService={editingService}
          key={editingService?.slug ?? "new-service"}
          onClose={closeServiceForm}
          onSave={saveServiceForm}
          suggestedOrder={services.length + 1}
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
        <AdminDetailDrawer
          ariaLabel="Детали цены"
          kicker="Цена"
          onClose={() => setIsPriceDrawerOpen(false)}
          subtitle={`${priceValue(selectedPrice)} · ${selectedPrice.status}`}
          title={priceLabel(selectedPrice, services)}
        >
        <div className="admin-detail-heading">
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

function FinanceWorkspace({ financeRows, query }: { financeRows: FinanceRow[]; query: string }) {
  const [exportNotice, setExportNotice] = useState("");
  const [periodStart, setPeriodStart] = useState("2026-07-01");
  const [periodEnd, setPeriodEnd] = useState("2026-07-03");
  const filteredFinanceRows = useMemo(
    () =>
      financeRows.filter((row) =>
        matchesDatePeriod(row.date, periodStart, periodEnd) &&
        matchesSearch([row.date, row.id, row.certificateCode, row.buyer, row.status, row.gross, row.refund], query),
      ),
    [financeRows, periodEnd, periodStart, query],
  );
  const currentSummary = useMemo(() => calculateFinanceSummary(filteredFinanceRows), [filteredFinanceRows]);
  const financePeriod = formatFinancePeriod(periodStart, periodEnd);

  async function handleExport() {
    try {
      const authorization = await getAdminAuthorizationHeader();
      const response = await fetch("/api/admin/finance/export", {
        body: JSON.stringify({
          format: "csv",
          periodEnd,
          periodStart,
        }),
        headers: {
          ...(authorization ? { Authorization: authorization } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        setExportNotice("CSV отчет недоступен для текущей роли.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);

      downloadBlob(filenameMatch?.[1] ?? "magic-massage-stripe-sales.csv", blob);
      setExportNotice(`CSV отчет за ${financePeriod} готов к скачиванию.`);
    } catch {
      setExportNotice("CSV отчет временно недоступен.");
    }
  }

  return (
    <section className="admin-panel admin-panel-large" aria-labelledby="finance-heading">
      <div className="admin-panel-head admin-panel-head-finance">
        <div>
          <h2 id="finance-heading">Stripe-продажи за период</h2>
          <p>Период считается по timezone бизнеса Europe/Sofia.</p>
        </div>
        <div className="admin-export-actions" aria-label="Форматы выгрузки">
          <button onClick={() => void handleExport()} type="button">
            CSV
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
  onSaveMedia: (media: MediaRecord, originalId?: string, cleanupPath?: string) => Promise<void>;
  query: string;
  role: AdminRoleId;
  selectedMediaId?: string;
}) {
  const initialSelectedMedia = selectedMediaId ? media.find((item) => item.id === selectedMediaId) : undefined;
  const [selectedId, setSelectedId] = useState(initialSelectedMedia?.id ?? media[0]?.id ?? "");
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState(Boolean(initialSelectedMedia));
  const [editingMedia, setEditingMedia] = useState<MediaRecord | undefined>();
  const [replacementPlacement, setReplacementPlacement] = useState<MediaPlacementRecord>();
  const [folderFilter, setFolderFilter] = useState("all");
  const [filter, setFilter] = useState<"all" | "photo" | "documents" | "needsAlt" | "used" | "unused">("all");
  const mediaFolders = Array.from(new Set(media.map((item) => item.folder))).sort();
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

      if (filter === "used") return (item.placements?.length ?? item.usage.length) > 0;
      if (filter === "unused") return (item.placements?.length ?? item.usage.length) === 0;

      return true;
    })
    .filter((item) => folderFilter === "all" || item.folder === folderFilter)
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

  async function saveMediaForm(item: MediaRecord, originalId?: string, cleanupPath?: string) {
    await onSaveMedia(item, originalId, cleanupPath);
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
            <button aria-pressed={filter === "used"} onClick={() => setFilter("used")} type="button">
              Используется
            </button>
            <button aria-pressed={filter === "unused"} onClick={() => setFilter("unused")} type="button">
              Не используется
            </button>
            <label className="admin-inline-filter">
              Папка
              <select onChange={(event) => setFolderFilter(event.target.value)} value={folderFilter}>
                <option value="all">Все</option>
                {mediaFolders.map((folder) => <option key={folder}>{folder}</option>)}
              </select>
            </label>
          </div>
        </div>

        <MediaGrid
          assets={filteredMedia}
          getAssetHref={(item) => mediaDetailHref(item.id, role)}
          onSelect={openMedia}
          selectedAssetId={isMediaDrawerOpen ? selectedMedia.id : undefined}
        />
      </section>

      {isMediaDrawerOpen ? (
        <AdminDetailDrawer
          ariaLabel="Детали медиа"
          kicker="Медиа"
          onClose={() => setIsMediaDrawerOpen(false)}
          subtitle={`${selectedMedia.type} · ${selectedMedia.status}`}
          title={selectedMedia.name}
        >
          <MediaDetail
            asset={selectedMedia}
            onEdit={openMediaEdit}
            onReplacePlacement={(placement) => {
              setIsMediaDrawerOpen(false);
              setReplacementPlacement(placement);
            }}
            showHeader={false}
          />
        </AdminDetailDrawer>
      ) : null}

      {replacementPlacement ? (
        <MediaPlacementEditor
          assets={media}
          onClose={() => setReplacementPlacement(undefined)}
          onReplaced={() => window.location.reload()}
          placement={replacementPlacement}
        />
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
        <AdminDetailDrawer
          ariaLabel="Детали контакта"
          kicker="Контакт"
          onClose={() => setIsContactDrawerOpen(false)}
          subtitle={selectedChannel ? `${selectedChannel.type} · ${selectedChannel.status}` : "Выберите контактный канал."}
          title={selectedChannel?.name ?? "Ничего не найдено"}
        >
        {selectedChannel ? (
          <>
            <div className="admin-detail-heading">
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
  blogEnabled,
  blogPosts,
  canManageBlogPosts,
  canManageBlogVisibility,
  isBlogCreateOpen,
  media,
  onCloseBlogCreate,
  onSaveBlogVisibility,
  onSaveBlogPost,
  query,
  role,
  selectedBlogPostId,
}: {
  blogEnabled: boolean;
  blogPosts: BlogPostRecord[];
  canManageBlogPosts: boolean;
  canManageBlogVisibility: boolean;
  isBlogCreateOpen: boolean;
  media: MediaRecord[];
  onCloseBlogCreate: () => void;
  onSaveBlogVisibility: (enabled: boolean) => Promise<boolean>;
  onSaveBlogPost: (post: BlogPostRecord, originalId?: string) => Promise<void>;
  query: string;
  role: AdminRoleId;
  selectedBlogPostId?: string;
}) {
  const groupedArticles = useMemo(() => groupLocalizedBlogArticles(blogPosts), [blogPosts]);
  const initialSelectedArticle = selectedBlogPostId
    ? groupedArticles.find(
        (article) => article.key === selectedBlogPostId || Object.values(article.translations).some((post) => post?.id === selectedBlogPostId),
      )
    : undefined;
  const initialSelectedPost = selectedBlogPostId ? blogPosts.find((post) => post.id === selectedBlogPostId) : undefined;
  const [selectedTranslationKey, setSelectedTranslationKey] = useState(initialSelectedArticle?.key ?? groupedArticles[0]?.key ?? "");
  const [detailLocale, setDetailLocale] = useState<BlogLocale>(
    initialSelectedPost ? getBlogPostLocale(initialSelectedPost) : initialSelectedArticle ? getBlogPostLocale(initialSelectedArticle.primaryPost) : "ru",
  );
  const [isBlogDrawerOpen, setIsBlogDrawerOpen] = useState(Boolean(initialSelectedArticle));
  const [editingTranslationKey, setEditingTranslationKey] = useState<string | undefined>();
  const [activeEditorLocale, setActiveEditorLocale] = useState<BlogLocale>("bg");
  const [editorDrafts, setEditorDrafts] = useState<Partial<Record<BlogLocale, BlogArticleDraft>>>({});
  const [savedEditorDrafts, setSavedEditorDrafts] = useState<Partial<Record<BlogLocale, BlogArticleDraft>>>({});
  const editorRecordIds = useRef<Partial<Record<BlogLocale, string>>>({});
  const editorSaveVersions = useRef<Partial<Record<BlogLocale, number>>>({});
  const newTranslationKey = useRef<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<"all" | BlogStatus>("all");
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [visibilityNotice, setVisibilityNotice] = useState("");
  const blogMediaOptions = media
    .filter(
      (item) =>
        item.type === "Фото" &&
        item.status === "Готово" &&
        Boolean(item.altText) &&
        ["granted", "not_required"].includes(item.publicationConsent ?? "unknown"),
    )
    .map((item) => ({ alt: item.altText, label: `${item.name} · ${item.folder}`, url: item.url }));
  const filteredArticles = groupedArticles
    .filter((article) => statusFilter === "all" || Object.values(article.translations).some((post) => post?.status === statusFilter))
    .filter((article) =>
      matchesSearch(
        Object.values(article.translations).flatMap((post) =>
          post
            ? [
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
              ]
            : [],
        ),
        query,
      ),
    )
    .sort((first, second) => second.primaryPost.updatedAt.localeCompare(first.primaryPost.updatedAt));
  const selectedArticle =
    filteredArticles.find((article) => article.key === selectedTranslationKey) ??
    filteredArticles[0] ??
    groupedArticles.find((article) => article.key === selectedTranslationKey) ??
    groupedArticles[0];
  const selectedPost = selectedArticle?.translations[detailLocale] ?? selectedArticle?.primaryPost;
  const isBlogFormOpen = isBlogCreateOpen || Boolean(editingTranslationKey);
  const publishedCount = groupedArticles.filter((article) =>
    Object.values(article.translations).some((post) => post?.status === "Опубликована"),
  ).length;
  const visibilityControl = (
    <div className="admin-blog-visibility" aria-busy={isSavingVisibility || undefined}>
      <label className="admin-checkbox-field">
        <input
          aria-describedby="blog-visibility-description"
          checked={blogEnabled}
          disabled={!canManageBlogVisibility || isSavingVisibility}
          onChange={async (event) => {
            const enabled = event.target.checked;
            setIsSavingVisibility(true);
            setVisibilityNotice("");
            const saved = await onSaveBlogVisibility(enabled);
            setVisibilityNotice(
              saved
                ? enabled
                  ? "Блог виден на сайте."
                  : "Блог скрыт на сайте; статьи сохранены в админке."
                : "Не удалось изменить видимость блога. Исходное состояние восстановлено.",
            );
            setIsSavingVisibility(false);
          }}
          role="switch"
          type="checkbox"
        />
        <span>{isSavingVisibility ? "Сохраняем видимость блога…" : "Показывать блог на сайте"}</span>
      </label>
      <p id="blog-visibility-description">
        {blogEnabled
          ? `Пункт меню, страница блога и ${publishedCount} опубликованных статей доступны посетителям.`
          : `Пункт меню, страница блога и ${publishedCount} опубликованных статей скрыты. Материалы остаются в админке.`}
        {!canManageBlogVisibility ? " Изменить видимость может редактор, администратор или владелец." : ""}
      </p>
      {visibilityNotice ? (
        <p className="admin-export-notice" role={visibilityNotice.startsWith("Не удалось") ? "alert" : "status"}>
          {visibilityNotice}
        </p>
      ) : null}
    </div>
  );

  function openArticle(article: (typeof groupedArticles)[number]) {
    setSelectedTranslationKey(article.key);
    setDetailLocale(getBlogPostLocale(article.primaryPost));
    setIsBlogDrawerOpen(true);
  }

  function openArticleEdit(article: (typeof groupedArticles)[number], locale = detailLocale) {
    onCloseBlogCreate();
    const drafts = Object.fromEntries(
      Object.entries(article.translations).map(([translationLocale, post]) => [
        translationLocale,
        blogPostToEditorDraft(post),
      ]),
    ) as Partial<Record<BlogLocale, BlogArticleDraft>>;
    const recordIds = Object.fromEntries(
      Object.entries(article.translations).map(([translationLocale, post]) => [translationLocale, post?.id]),
    ) as Partial<Record<BlogLocale, string>>;
    const nextLocale = article.translations[locale] ? locale : getBlogPostLocale(article.primaryPost);

    editorRecordIds.current = recordIds;
    editorSaveVersions.current = {};
    newTranslationKey.current = undefined;
    setEditingTranslationKey(article.key);
    setActiveEditorLocale(nextLocale);
    setEditorDrafts(drafts);
    setSavedEditorDrafts(drafts);
    setIsBlogDrawerOpen(false);
  }

  function closeBlogForm() {
    const shouldRestoreDetails = Boolean(editingTranslationKey && groupedArticles.some((article) => article.key === editingTranslationKey));
    setEditingTranslationKey(undefined);
    setEditorDrafts({});
    setSavedEditorDrafts({});
    editorRecordIds.current = {};
    editorSaveVersions.current = {};
    newTranslationKey.current = undefined;
    onCloseBlogCreate();
    if (shouldRestoreDetails) setIsBlogDrawerOpen(true);
  }

  function editorStatusLabel(status: BlogEditorStatus) {
    return blogStatusByEditorStatus[status];
  }

  function getEditorTranslationKey() {
    if (editingTranslationKey) return editingTranslationKey;
    if (!newTranslationKey.current) newTranslationKey.current = `blog-${crypto.randomUUID()}`;
    return newTranslationKey.current;
  }

  function getEditorRecordId(locale: BlogLocale, translationKey: string) {
    const existingId = editorRecordIds.current[locale];
    if (existingId) return existingId;

    const isFirstNewTranslation = !editingTranslationKey && Object.keys(editorRecordIds.current).length === 0;
    const nextId = isFirstNewTranslation ? translationKey : `${translationKey}-${locale}`;
    editorRecordIds.current[locale] = nextId;
    return nextId;
  }

  async function saveEditorLocale(draft: BlogArticleDraft) {
    const saveVersion = (editorSaveVersions.current[draft.locale] ?? 0) + 1;
    editorSaveVersions.current[draft.locale] = saveVersion;
    const translationKey = getEditorTranslationKey();
    const article = groupedArticles.find((candidate) => candidate.key === translationKey);
    const original = article?.translations[draft.locale];
    const recordId = getEditorRecordId(draft.locale, translationKey);
    const post = editorDraftToBlogPost(draft, original, recordId, translationKey);

    await onSaveBlogPost(post, original?.id);
    if (editorSaveVersions.current[draft.locale] !== saveVersion) return;
    setEditingTranslationKey(translationKey);
    setSelectedTranslationKey(translationKey);
    setDetailLocale(draft.locale);
    setEditorDrafts((current) => {
      const currentDraft = current[draft.locale];
      return currentDraft && serializeArticleDraft(currentDraft) !== serializeArticleDraft(draft)
        ? current
        : { ...current, [draft.locale]: draft };
    });
    setSavedEditorDrafts((current) => ({ ...current, [draft.locale]: draft }));
  }

  if (isBlogFormOpen) {
    const value = editorDrafts[activeEditorLocale] ?? createEmptyBlogArticle(activeEditorLocale);
    const savedValue = savedEditorDrafts[activeEditorLocale];
    const dirtyLocales = new Set(
      BLOG_LOCALES.filter((locale) => {
        const draft = editorDrafts[locale];
        const savedDraft = savedEditorDrafts[locale];
        return Boolean(draft && (!savedDraft || serializeArticleDraft(draft) !== serializeArticleDraft(savedDraft)));
      }),
    );
    const statusByLocale = Object.fromEntries(
      BLOG_LOCALES.map((locale) => {
        const draft = editorDrafts[locale];
        const article = groupedArticles.find((candidate) => candidate.key === editingTranslationKey);
        const post = article?.translations[locale];
        return [locale, draft ? editorStatusLabel(draft.status) : getBlogTranslationStatusLabel(post)];
      }),
    ) as Partial<Record<BlogLocale, string>>;

    return (
      <BlogArticleEditor
        authorOptions={["Natali"]}
        cancelLabel="К списку"
        categoryOptions={["Советы", "Услуги", "Сертификаты", "Студия"]}
        key={`${editingTranslationKey ?? "new"}:${activeEditorLocale}`}
        localeLocked
        localeNavigation={
          <BlogLocaleTabs
            activeLocale={activeEditorLocale}
            dirtyLocales={dirtyLocales}
            onSelect={setActiveEditorLocale}
            statusByLocale={statusByLocale}
          />
        }
        mediaOptions={blogMediaOptions}
        onCancel={({ hasUnsavedChanges }) => {
          const unsavedLocales = new Set(dirtyLocales);
          if (hasUnsavedChanges) unsavedLocales.add(activeEditorLocale);
          if (
            unsavedLocales.size > 0 &&
            !window.confirm(`Есть несохраненные изменения: ${[...unsavedLocales].map((locale) => BLOG_LOCALE_LABELS[locale]).join(", ")}. Закрыть редактор?`)
          ) return;
          closeBlogForm();
        }}
        onChange={(draft) => setEditorDrafts((current) => ({ ...current, [activeEditorLocale]: draft }))}
        onAutosave={saveEditorLocale}
        onSave={saveEditorLocale}
        savedValue={savedValue}
        saveLabel={`Сохранить ${BLOG_LOCALE_LABELS[activeEditorLocale]}`}
        value={value}
      />
    );
  }

  if (!selectedPost) {
    return (
      <section className="admin-panel admin-panel-large" aria-labelledby="blog-heading">
        <div className="admin-panel-head">
          <div>
            <h2 id="blog-heading">Контент-план блога</h2>
            <p>Статьи сайта, категории, теги, SEO, локали, обложки и статус публикации.</p>
          </div>
        </div>
        {visibilityControl}
        <EmptyState label="Статьи пока не заведены." />
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

        {visibilityControl}

        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Статья</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Обновлено</th>
                <th>Языковые версии</th>
              </tr>
            </thead>
            <tbody>
              {filteredArticles.map((article) => (
                <tr aria-selected={isBlogDrawerOpen && article.key === selectedArticle?.key} key={article.key}>
                  <td>
                    <Link
                      className="admin-row-action admin-row-link"
                      href={blogDetailHref(article.primaryPost.id, role)}
                      onClick={() => openArticle(article)}
                    >
                      {article.primaryPost.title}
                    </Link>
                  </td>
                  <td>{article.primaryPost.category}</td>
                  <td>
                    <span className={statusClass(article.status)}>{article.status}</span>
                  </td>
                  <td className="admin-tabular">{article.primaryPost.updatedAt}</td>
                  <td>
                    <div className="admin-blog-locale-badges" aria-label="Статусы языковых версий">
                      {BLOG_LOCALES.map((locale) => {
                        const translation = article.translations[locale];
                        return (
                          <span data-missing={translation ? undefined : "true"} key={locale}>
                            <strong>{BLOG_LOCALE_LABELS[locale]}</strong>
                            <small>{translation ? translation.status : "Нет"}</small>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredArticles.length === 0 ? <EmptyState label="Статьи не найдены." /> : null}
      </section>

      {isBlogDrawerOpen ? (
        <AdminDetailDrawer
          ariaLabel="Детали статьи"
          kicker="Статья"
          onClose={() => setIsBlogDrawerOpen(false)}
          subtitle={`${selectedPost.slug} · ${selectedPost.status}`}
          title={selectedPost.title}
        >
        <div className="admin-detail-heading">
          <div className="admin-detail-actions">
            {canManageBlogPosts ? (
              <button className="admin-text-action" onClick={() => selectedArticle && openArticleEdit(selectedArticle, detailLocale)} type="button">
                Редактировать
              </button>
            ) : null}
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
            <dt>Языковые версии</dt>
            <dd>
              <div className="admin-blog-detail-locales" aria-label="Выбрать языковую версию">
                {BLOG_LOCALES.map((locale) => {
                  const translation = selectedArticle?.translations[locale];
                  return (
                    <button
                      aria-pressed={detailLocale === locale}
                      disabled={!translation}
                      key={locale}
                      onClick={() => setDetailLocale(locale)}
                      type="button"
                    >
                      {BLOG_LOCALE_LABELS[locale]} · {translation?.status ?? "Нет перевода"}
                    </button>
                  );
                })}
              </div>
            </dd>
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
        <AdminDetailDrawer
          ariaLabel="Детали настроек"
          kicker="Настройки"
          onClose={() => setIsSettingsDrawerOpen(false)}
          subtitle={selectedGroup?.summary ?? "Измените поиск, чтобы выбрать группу настроек."}
          title={selectedGroup?.title ?? "Ничего не найдено"}
        >
        {!selectedGroup ? (
          <p>Измените поиск, чтобы выбрать группу настроек.</p>
        ) : (
          <>
        <div className="admin-detail-heading">
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
              <dt>Рабочий график</dt>
              <dd>Индивидуально для каждого специалиста; редактируется в календаре.</dd>
            </div>
            <div>
              <dt>Перерыв между сеансами</dt>
              <dd>{settings.bookingBufferMinutes} минут</dd>
            </div>
            <div>
              <dt>Публичный лимит в день</dt>
              <dd>{settings.publicBookingDailyLimit ?? settings.dailySlotCapacity} записей; вручную можно больше</dd>
            </div>
            <div>
              <dt>Онлайн-запись</dt>
              <dd>{settings.publicBookingEnabled ? "Включена" : "Отключена; используется Studio24"}</dd>
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
              <dd>{settings.giftCertificatesEnabled !== false ? "Включены на сайте" : "Скрыты на сайте"}</dd>
            </div>
          </dl>
        ) : null}

        {selectedGroup.id === "email" ? (
          <dl className="admin-detail-list">
            <div>
              <dt>Письма клиентам о записях</dt>
              <dd>{settings.bookingCustomerEmailsEnabled ? "Включены" : "Выключены"}</dd>
            </div>
            <div>
              <dt>Уведомления Натали</dt>
              <dd>
                {settings.ownerNotificationsEnabled
                  ? `Включены · ${settings.ownerNotificationEmail || "email не задан"}`
                  : "Выключены"}
              </dd>
            </div>
            <div>
              <dt>Письма после визита</dt>
              <dd>{settings.careEmailsEnabled ? "Включены" : "Выключены"}</dd>
            </div>
            <div>
              <dt>Ссылка для отзыва</dt>
              <dd>{settings.emailReviewUrl || "Не задана"}</dd>
            </div>
            <div>
              <dt>Проверенный отправитель</dt>
              <dd>{settings.verifiedEmailSender || "RESEND_FROM_EMAIL не настроен"}</dd>
            </div>
            <div>
              <dt>Расписание</dt>
              <dd>До 5 минут · перенос через 2 минуты · напоминание за 24 часа</dd>
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
        <AdminDetailDrawer
          ariaLabel="Детали пользователя"
          kicker="Доступ"
          onClose={() => setIsUserDrawerOpen(false)}
          subtitle={`${selectedUser.email} · ${roleLabels[selectedUser.role]} · ${selectedUser.status}`}
          title={selectedUser.name}
        >
        <div className="admin-detail-heading">
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
  activeTimeSelection,
  actorUserId,
  adminUsers,
  appointments,
  blogPosts,
  calendarBlocks,
  calendarAppointmentFocus,
  certificates,
  clients,
  contactChannels,
  contactSettings,
  financeRows,
  hasLoadError,
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
  onCreateCalendarBlock,
  onCreateWalkIn,
  onDeleteCalendarBlock,
  onDeleteAppointment,
  onDeleteClient,
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
  onEditCalendarBlock,
  onAppointmentPublicEmailCorrected,
  onSaveAppointment,
  onSaveBlogVisibility,
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
  onSaveSpecialistSchedule,
  onSelectTimeRange,
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
  showGiftReconciliation,
  specialists,
  currentSpecialistId,
}: {
  activeTimeSelection?: CalendarTimeSelection;
  actorUserId?: string;
  adminUsers: AdminUserRecord[];
  appointments: Appointment[];
  blogPosts: BlogPostRecord[];
  calendarBlocks: CalendarBlock[];
  calendarAppointmentFocus?: CalendarAppointmentFocus;
  certificates: CertificateRecord[];
  clients: ClientRecord[];
  contactChannels: ContactChannelRecord[];
  contactSettings: ContactSettingsRecord;
  financeRows: FinanceRow[];
  hasLoadError: boolean;
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
  onCreateCalendarBlock: (date: string) => void;
  onCreateWalkIn: () => void;
  onDeleteCalendarBlock: (block: CalendarBlock) => void;
  onDeleteAppointment: (appointment: Appointment) => void;
  onDeleteClient: (client: ClientRecord) => Promise<CalendarAppointmentSaveResult>;
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
  onEditCalendarBlock: (block: CalendarBlock) => void;
  onAppointmentPublicEmailCorrected: (appointmentId: string, email: string) => void;
  onSaveAppointment: (
    appointment: Appointment,
    action?: AdminAuditAction,
    originalAppointment?: Appointment,
  ) => Promise<CalendarAppointmentSaveResult>;
  onSaveBlogVisibility: (enabled: boolean) => Promise<boolean>;
  onOpenSettingsEdit: () => void;
  onSaveAdminUser: (user: AdminUserRecord, originalId?: string) => void;
  onSaveBlogPost: (post: BlogPostRecord, originalId?: string) => Promise<void>;
  onSaveCertificate: (certificate: CertificateRecord, originalCode?: string) => void;
  onSaveClient: (client: ClientRecord, originalClientName?: string) => void;
  onSaveClientNote: (clientName: string, note: string) => void;
  onSaveContactChannel: (channel: ContactChannelRecord, originalId?: string) => void;
  onSaveContactSettings: (settings: ContactSettingsRecord) => void;
  onSaveMedia: (media: MediaRecord, originalId?: string, cleanupPath?: string) => Promise<void>;
  onSavePrice: (price: PriceRecord, originalId?: string) => void;
  onSaveService: (service: ServiceRecord, originalSlug?: string) => void;
  onSaveSpecialistSchedule: (
    specialistId: string,
    weeklySchedule: SpecialistScheduleDay[],
  ) => Promise<SpecialistScheduleSaveResult>;
  onSelectTimeRange: (selection: CalendarTimeSelection) => void;
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
  showGiftReconciliation: boolean;
  specialists: SpecialistRecord[];
  currentSpecialistId?: string;
}) {
  if (section === "dashboard") {
    return (
      <DashboardWorkspace
        appointments={appointments}
        certificates={certificates}
        clients={clients}
        financeRows={financeRows}
        hasLoadError={hasLoadError}
        onSaveAppointment={onSaveAppointment}
        query={query}
        role={role}
        timeZone={settings.timezone}
      />
    );
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
        onDeleteClient={onDeleteClient}
        onSaveCertificate={onSaveCertificate}
        onSaveAppointment={onSaveAppointment}
        onSaveClient={onSaveClient}
        onSaveClientNote={onSaveClientNote}
        query={query}
        role={role}
        selectedClientName={selectedClientName}
        timeZone={settings.timezone}
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
        showGiftReconciliation={showGiftReconciliation}
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
        blogEnabled={settings.blogEnabled !== false}
        blogPosts={blogPosts}
        canManageBlogPosts={role === "owner" || role === "administrator" || role === "editor"}
        canManageBlogVisibility={role === "owner" || role === "administrator" || role === "editor"}
        isBlogCreateOpen={isBlogCreateOpen}
        key={selectedBlogPostId ?? "default-blog"}
        onCloseBlogCreate={onCloseBlogCreate}
        onSaveBlogVisibility={onSaveBlogVisibility}
        onSaveBlogPost={onSaveBlogPost}
        media={media}
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
        activeTimeSelection={activeTimeSelection}
        actorUserId={actorUserId}
        appointments={appointments}
        bookingBufferMinutes={settings.bookingBufferMinutes}
        calendarBlocks={calendarBlocks}
        canManageBlocks={role === "owner" || role === "administrator"}
        clients={clients}
        currentSpecialistId={currentSpecialistId}
        dailySlotCapacity={settings.publicBookingDailyLimit ?? settings.dailySlotCapacity}
        key={`${selectedCalendarDate ?? "default-calendar"}:${selectedClientName ?? "all-clients"}:${calendarAppointmentFocus?.appointmentKey ?? "default-focus"}`}
        onCancelAppointment={onCancelAppointment}
        onCreateCalendarBlock={onCreateCalendarBlock}
        onCreateWalkIn={onCreateWalkIn}
        onDeleteCalendarBlock={onDeleteCalendarBlock}
        onDeleteAppointment={onDeleteAppointment}
        onCalendarDateChange={onCalendarDateChange}
        onEditAppointment={onEditAppointment}
        onEditCalendarBlock={onEditCalendarBlock}
        onAppointmentPublicEmailCorrected={onAppointmentPublicEmailCorrected}
        onSaveAppointment={onSaveAppointment}
        onSaveSpecialistSchedule={onSaveSpecialistSchedule}
        onSelectTimeRange={onSelectTimeRange}
        query={query}
        role={role}
        selectedAppointmentFocus={calendarAppointmentFocus}
        selectedCalendarDate={selectedCalendarDate}
        selectedClientName={selectedClientName}
        siteSettings={settings}
        specialists={specialists}
      />
    );
  }

  if (section === "finances") {
    return <FinanceWorkspace financeRows={financeRows} query={query} />;
  }

  return <GenericWorkspace query={query} section={section} />;
}

export function AdminShell({
  activeSection,
  actorUserId,
  calendarAction,
  initialData,
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
  const activeDescription = role === "specialist" && activeSection === "dashboard"
    ? "Ваши ближайшие записи и быстрый переход в личный календарь."
    : activeModule.description;
  const canManageAppointments = role === "owner" || role === "administrator";
  const canManageBlogPosts = role === "owner" || role === "administrator" || role === "editor";
  const canUsePrimaryAction =
    (activeSection !== "calendar" || canManageAppointments) &&
    (activeSection !== "blog" || canManageBlogPosts);
  const initialRecords = useMemo(() => buildInitialAdminRecords(initialData), [initialData]);
  const initialFinanceRows = useMemo(() => buildInitialFinanceRows(initialData), [initialData]);
  const [specialists, setSpecialists] = useState<SpecialistRecord[]>(() => initialRecords.specialists ?? []);
  const [query, setQuery] = useState("");
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | undefined>();
  const [deletingAppointment, setDeletingAppointment] = useState<Appointment | undefined>();
  const [dismissedCalendarActionKey, setDismissedCalendarActionKey] = useState("");
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>();
  const [editingCalendarBlock, setEditingCalendarBlock] = useState<CalendarBlock | undefined>();
  const [calendarBlockDate, setCalendarBlockDate] = useState("");
  const [calendarBlockEndsAt, setCalendarBlockEndsAt] = useState<string>();
  const [calendarBlockIntent, setCalendarBlockIntent] = useState<"block" | "walk-in">("block");
  const [calendarBlockSpecialistId, setCalendarBlockSpecialistId] = useState<string>();
  const [calendarBlockStartsAt, setCalendarBlockStartsAt] = useState<string>();
  const [isCalendarBlockDialogOpen, setIsCalendarBlockDialogOpen] = useState(false);
  const [calendarTimeSelection, setCalendarTimeSelection] = useState<CalendarTimeSelection>();
  const [appointmentCreateSelection, setAppointmentCreateSelection] = useState<CalendarTimeSelection>();
  const [calendarAppointments, setCalendarAppointments] = useState<Appointment[]>(() =>
    buildInitialCalendarAppointments(initialRecords),
  );
  const [calendarBlocks, setCalendarBlocks] = useState<CalendarBlock[]>(() =>
    buildInitialCalendarBlocks(initialRecords),
  );
  const [clientRecords, setClients] = useState<ClientRecord[]>(() => buildInitialClientRows(initialRecords));
  const [certificates, setCertificates] = useState<CertificateRecord[]>(() => buildInitialCertificateRows(initialRecords));
  const [stripeSales] = useState<FinanceRow[]>(() => initialFinanceRows);
  const [services, setServices] = useState<ServiceRecord[]>(() => buildInitialServiceRows(initialData));
  const [prices, setPrices] = useState<PriceRecord[]>(() => buildInitialPriceRows(initialData));
  const [media, setMedia] = useState<MediaRecord[]>(() => buildInitialMediaRows(initialData));
  const [contactChannels, setContactChannels] = useState<ContactChannelRecord[]>(() => buildInitialContactChannels(initialData));
  const [contactSettings, setContactSettings] = useState<ContactSettingsRecord>(() => buildInitialContactSettings(initialData));
  const [blogPosts, setBlogPosts] = useState<BlogPostRecord[]>(() => buildInitialBlogPostRows(initialData));
  const [settings, setSettings] = useState<SettingsRecord>(() => buildInitialSettingsRecord(initialData));
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>(() => buildInitialAdminUsers(initialData));
  const [clientSummaryClock, setClientSummaryClock] = useState(() => new Date());
  const isSupabaseBacked = initialData?.source === "supabase";
  const clients = useMemo(
    () => isSupabaseBacked
      ? reconcileClientAppointmentSummaries(
          clientRecords,
          calendarAppointments,
          getLocalDateTimeKey(clientSummaryClock, settings.timezone),
        )
      : clientRecords,
    [calendarAppointments, clientRecords, clientSummaryClock, isSupabaseBacked, settings.timezone],
  );
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setClientSummaryClock(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const {
    message: persistenceStatus,
    showStatus: showPersistenceStatus,
    variant: persistenceStatusVariant,
  } = useTransientStatus(activeSection);
  const selectedRouteAppointment = selectedAppointmentKey
    ? calendarAppointments.find((appointment) => appointmentKey(appointment) === selectedAppointmentKey)
    : undefined;
  const selectedCalendarRouteDate = selectedCalendarDate && isIsoDate(selectedCalendarDate)
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
    date: selectedCalendarRouteDate ?? getSofiaIsoDate(),
    routeDate: selectedCalendarRouteDate,
  }));
  const [calendarAppointmentFocus, setCalendarAppointmentFocus] = useState<CalendarAppointmentFocus | undefined>();
  const activeCalendarAppointmentFocus =
    calendarAppointmentFocus?.routeDate === selectedCalendarRouteDate ? calendarAppointmentFocus : routeCalendarAppointmentFocus;
  const activeCalendarDate =
    calendarSelection.routeDate === selectedCalendarRouteDate
      ? calendarSelection.date
      : (selectedCalendarRouteDate ?? getSofiaIsoDate());
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
    canManageAppointments
    && activeSection === "calendar"
    && calendarAction === "create"
    && dismissedCalendarActionKey !== calendarActionKey;
  const isCalendarActionDialogOpen = activeSection === "calendar" && (isActionOpen || shouldOpenCalendarCreateDialog);
  const shouldPrefillCalendarClient = shouldOpenCalendarCreateDialog && !isActionOpen && !editingAppointment;
  const prefilledCalendarClient = shouldPrefillCalendarClient ? findClientByIdentity(clients, selectedClientName) : undefined;
  const calendarDialogKey = editingAppointment
    ? `edit-${appointmentKey(editingAppointment)}`
    : appointmentCreateSelection
      ? `selection-${appointmentCreateSelection.date}-${appointmentCreateSelection.startsAt}-${appointmentCreateSelection.durationMinutes}-${appointmentCreateSelection.specialistId ?? "choose"}`
    : shouldPrefillCalendarClient
      ? `prefill-${calendarActionKey}`
      : "new-empty-appointment";

  async function getAdminApiHeaders() {
    const authorization = await getAdminAuthorizationHeader();

    return {
      ...(authorization ? { Authorization: authorization } : {}),
      "Content-Type": "application/json",
    };
  }

  function openCalendarBlockCreate(date: string, selection?: CalendarTimeSelection) {
    setEditingCalendarBlock(undefined);
    setCalendarBlockDate(date);
    setCalendarBlockEndsAt(selection?.endsAt);
    setCalendarBlockIntent("block");
    setCalendarBlockSpecialistId(selection?.specialistId);
    setCalendarBlockStartsAt(selection?.startsAt);
    setIsCalendarBlockDialogOpen(true);
  }

  function openCalendarTimeSelection(selection: CalendarTimeSelection) {
    setEditingAppointment(undefined);
    setAppointmentCreateSelection(undefined);
    setIsActionOpen(false);
    setIsCalendarBlockDialogOpen(false);
    setCalendarTimeSelection(selection);
  }

  function createBlockFromTimeSelection(selection: CalendarTimeSelection) {
    setCalendarTimeSelection(undefined);
    openCalendarBlockCreate(selection.date, selection);
  }

  function createAppointmentFromTimeSelection(selection: CalendarTimeSelection) {
    setCalendarTimeSelection(undefined);
    setCancellingAppointment(undefined);
    setEditingAppointment(undefined);
    setAppointmentCreateSelection(selection);
    updateActiveCalendarDate(selection.date);
    setIsActionOpen(true);
  }

  function openCurrentClientBlock() {
    const window = getSofiaWalkInWindow();
    setEditingCalendarBlock(undefined);
    setCalendarBlockDate(getSofiaIsoDate());
    setCalendarBlockEndsAt(window.endsAt);
    setCalendarBlockIntent("walk-in");
    setCalendarBlockSpecialistId(undefined);
    setCalendarBlockStartsAt(window.startsAt);
    setIsCalendarBlockDialogOpen(true);
  }

  function openCalendarBlockEdit(block: CalendarBlock) {
    setEditingCalendarBlock(block);
    setCalendarBlockDate(block.blockDate);
    setCalendarBlockEndsAt(undefined);
    setCalendarBlockIntent("block");
    setCalendarBlockSpecialistId(block.specialistId);
    setCalendarBlockStartsAt(undefined);
    setIsCalendarBlockDialogOpen(true);
  }

  function closeCalendarBlockDialog() {
    setIsCalendarBlockDialogOpen(false);
    setEditingCalendarBlock(undefined);
    setCalendarBlockSpecialistId(undefined);
  }

  async function saveCalendarBlock(block: CalendarBlock): Promise<CalendarBlockSaveResult> {
    if (!isSupabaseBacked) {
      setCalendarBlocks((current) => [
        ...current.filter((candidate) => candidate.id !== block.id),
        block,
      ]);
      showPersistenceStatus("Недоступное время сохранено в демо-режиме.", { autoDismiss: true });
      return { ok: true };
    }

    try {
      const response = await fetch("/api/admin/calendar-blocks", {
        body: JSON.stringify(createCalendarBlockMutationPayload(
          block,
          calendarBlockIntent,
          Boolean(editingCalendarBlock),
        )),
        headers: await getAdminApiHeaders(),
        method: editingCalendarBlock ? "PATCH" : "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | { block?: CalendarBlock; error?: string }
        | null;

      if (!response.ok || !result?.block) {
        return { message: result?.error ?? "Не удалось сохранить недоступное время.", ok: false };
      }

      const savedBlock = result.block;
      setCalendarBlocks((current) => [
        ...current.filter((candidate) => candidate.id !== savedBlock.id),
        savedBlock,
      ]);
      showPersistenceStatus("Недоступное время сохранено в Supabase.", { autoDismiss: true });
      return { ok: true };
    } catch {
      return { message: "Сервер недоступен. Повторите попытку.", ok: false };
    }
  }

  async function deleteCalendarBlock(block: CalendarBlock) {
    if (!window.confirm(`Удалить недоступное время ${block.startsAt} - ${block.endsAt}?`)) return;

    if (!isSupabaseBacked) {
      setCalendarBlocks((current) => current.filter((candidate) => candidate.id !== block.id));
      showPersistenceStatus("Недоступное время удалено в демо-режиме.", { autoDismiss: true });
      return;
    }

    try {
      const response = await fetch("/api/admin/calendar-blocks", {
        body: JSON.stringify({ id: block.id, version: block.version ?? 1 }),
        headers: await getAdminApiHeaders(),
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        showPersistenceStatus(result?.error ?? "Не удалось удалить недоступное время.", { variant: "error" });
        return;
      }

      setCalendarBlocks((current) => current.filter((candidate) => candidate.id !== block.id));
      showPersistenceStatus("Недоступное время удалено из Supabase.", { autoDismiss: true });
    } catch {
      showPersistenceStatus("Сервер недоступен. Повторите попытку.", { variant: "error" });
    }
  }

  async function saveSpecialistSchedule(
    specialistId: string,
    weeklySchedule: SpecialistScheduleDay[],
  ): Promise<SpecialistScheduleSaveResult> {
    const specialist = specialists.find((candidate) => candidate.id === specialistId);
    const expectedVersion = specialist?.scheduleVersion ?? 1;

    if (!isSupabaseBacked) {
      setSpecialists((current) => current.map((candidate) => (
        candidate.id === specialistId
          ? { ...candidate, scheduleVersion: expectedVersion + 1, weeklySchedule }
          : candidate
      )));
      showPersistenceStatus("График сохранён в демо-режиме.", { autoDismiss: true });
      return { ok: true };
    }

    try {
      const response = await fetch("/api/admin/specialist-schedules", {
        body: JSON.stringify({ expectedVersion, specialistId, weeklySchedule }),
        headers: await getAdminApiHeaders(),
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            specialist?: {
              id: string;
              scheduleVersion: number;
              weeklySchedule: SpecialistScheduleDay[];
            };
            workingDays?: string;
            workingHours?: string;
          }
        | null;

      if (!response.ok || !result?.specialist) {
        return {
          message: result?.error ?? "Не удалось сохранить график работы.",
          ok: false,
        };
      }

      setSpecialists((current) => current.map((specialist) => (
        specialist.id === result.specialist?.id
          ? {
              ...specialist,
              scheduleVersion: result.specialist.scheduleVersion,
              weeklySchedule: result.specialist.weeklySchedule,
            }
          : specialist
      )));
      if (hasScheduleEnvelope(result)) {
        setSettings((current) => ({
          ...current,
          workingDays: result.workingDays as string,
          workingHours: result.workingHours as string,
        }));
      }
      showPersistenceStatus("График сохранён. Онлайн-запись обновлена.", { autoDismiss: true });
      return { ok: true };
    } catch {
      return { message: "Сервер недоступен. Повторите попытку.", ok: false };
    }
  }

  async function handleLogout() {
    await signOutAdminBrowserSession();
    await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/admin/login");
  }

  async function persistAdminRecord(input: AdminPersistInput): Promise<CalendarAppointmentSaveResult> {
    if (!isSupabaseBacked) {
      return { ok: true };
    }

    try {
      const response = await fetch("/api/admin/records", {
        body: JSON.stringify(input),
        headers: await getAdminApiHeaders(),
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            ok?: boolean;
            record?: ClientRecord;
            version?: number;
          }
        | null;

      if (!response.ok || result?.ok === false) {
        const message = result?.message ?? result?.error ?? "Supabase не подтвердил изменение. Исходные данные восстановлены.";
        showPersistenceStatus(message, { variant: "error" });
        return { client: result?.record, message, ok: false };
      }

      showPersistenceStatus("Изменение сохранено в Supabase.", { autoDismiss: true });
      return { client: result?.record, ok: true, version: result?.version };
    } catch {
      const message = "Supabase недоступен. Исходные данные восстановлены.";
      showPersistenceStatus(message, { variant: "error" });
      return { message, ok: false };
    }
  }

  async function persistAdminDelete(input: AdminDeleteInput): Promise<CalendarAppointmentSaveResult> {
    if (!isSupabaseBacked) return { ok: true };

    try {
      const response = await fetch("/api/admin/records", {
        body: JSON.stringify(input),
        headers: await getAdminApiHeaders(),
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; ok?: boolean }
        | null;

      if (!response.ok || result?.ok === false) {
        const message = result?.error ?? result?.message ?? "Не удалось удалить запись.";
        showPersistenceStatus(message, { variant: "error" });
        return { message, ok: false };
      }

      showPersistenceStatus("Удаление сохранено в Supabase.", { autoDismiss: true });
      return { ok: true };
    } catch {
      const message = "Сервер недоступен. Запись не удалена.";
      showPersistenceStatus(message, { variant: "error" });
      return { message, ok: false };
    }
  }

  async function persistAdminUserAction(input: AdminUserActionInput): Promise<AdminUserActionResult | undefined> {
    if (!isSupabaseBacked) {
      return undefined;
    }

    try {
      const response = await fetch("/api/admin/users", {
        body: JSON.stringify(input),
        headers: await getAdminApiHeaders(),
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as AdminUserActionResult | null;

      if (!response.ok || result?.ok === false) {
        showPersistenceStatus(result?.message ?? "Пользователь сохранен локально, но Supabase Auth не подтвердил запись.");
        return result ?? undefined;
      }

      showPersistenceStatus(
        input.action === "invite"
          ? "Приглашение пользователя отправлено через Supabase Auth."
          : "Роль пользователя сохранена в Supabase.",
        { autoDismiss: true },
      );
      return result ?? undefined;
    } catch {
      showPersistenceStatus("Пользователь сохранен локально, но Supabase Auth недоступен.");
      return undefined;
    }
  }

  async function persistAppointmentRecord(
    appointment: Appointment,
    action: AdminAuditAction,
    originalAppointment: Appointment = appointment,
    options: { notifyClient: boolean } = { notifyClient: true },
  ): Promise<CalendarAppointmentSaveResult> {
    if (!appointment.clientId) {
      if (isSupabaseBacked) {
        const message = "Запись не сохранена: выберите клиента из базы для сохранения в Supabase.";
        showPersistenceStatus(message);
        return { message, ok: false };
      }

      return { ok: true };
    }

    const appointmentTime = {
      date: appointment.date,
      duration: appointment.durationMinutes ?? 60,
      specialistId: appointment.specialistId,
      start: appointment.time,
    };
    const overlap = hasAppointmentOverlap(
      appointmentTime,
      calendarAppointments
        .filter(
          (candidate) =>
            appointmentKey(candidate) !== appointmentKey(originalAppointment) && candidate.status !== "Отменена",
        )
        .map((candidate) => ({
          date: candidate.date,
          duration: candidate.durationMinutes ?? 60,
          specialistId: candidate.specialistId,
          start: candidate.time,
        })),
    );
    const appointmentSpecialist = specialists.find(
      (specialist) => specialist.id === appointment.specialistId,
    );
    const appointmentSchedule = appointmentSpecialist
      ? createSpecialistWorkingSchedule(appointmentSpecialist, settings.timezone)
      : createCalendarWorkingSchedule(settings);
    const scheduleClassification = classifyAppointmentAgainstSchedule(
      appointmentTime,
      appointmentSchedule,
    );

    const audit = {
      action,
      notifyClient: options.notifyClient,
      outsideWorkingHours: scheduleClassification.outsideWorkingHours,
      overlapOverride: overlap,
    };
    const result = await persistAdminRecord({
      audit,
      record: appointment,
      type: "appointment",
    });

    return result.ok
      ? result
      : {
          message: "Не удалось сохранить изменение записи. Исходное значение восстановлено.",
          ok: false,
        };
  }

  function handleAppointmentCreate(appointment: Appointment) {
    const createdAppointment = {
      ...appointment,
      id: `custom-${crypto.randomUUID()}`,
    };

    setCalendarAppointments((current) => sortAppointments([...current, createdAppointment]));

    return createdAppointment;
  }

  function handleAppointmentUpdate(appointment: Appointment, originalKey = appointmentKey(appointment)) {
    setCalendarAppointments((current) =>
      sortAppointments(
        current.map((currentAppointment) =>
          appointmentKey(currentAppointment) === originalKey ? appointment : currentAppointment,
        ),
      ),
    );
  }

  function handleAppointmentPublicEmailCorrected(appointmentId: string, email: string) {
    setCalendarAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId ? { ...appointment, publicEmail: email } : appointment,
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
    setAppointmentCreateSelection(undefined);

    if (!canUsePrimaryAction) return;

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
    setAppointmentCreateSelection(undefined);
    setIsActionOpen(true);
  }

  function openAppointmentCancel(appointment: Appointment) {
    setDeletingAppointment(undefined);
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

  function openAppointmentDelete(appointment: Appointment) {
    setCancellingAppointment(undefined);
    setEditingAppointment(undefined);
    setIsActionOpen(false);
    setDeletingAppointment(appointment);
  }

  function prepareCalendarCreateFromClient() {
    setDismissedCalendarActionKey("");
    setCancellingAppointment(undefined);
    setEditingAppointment(undefined);
    setAppointmentCreateSelection(undefined);
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
    setAppointmentCreateSelection(undefined);
  }

  function closeCancelDialog() {
    setCancellingAppointment(undefined);
  }

  function closeAppointmentDeleteDialog() {
    setDeletingAppointment(undefined);
  }

  async function saveCalendarAppointment(
    appointment: Appointment,
    options: { notifyClient: boolean },
  ): Promise<CalendarAppointmentSaveResult> {
    let persistedAppointment = appointment;
    const previousAppointment = editingAppointment;

    if (previousAppointment) {
      handleAppointmentUpdate(appointment, appointmentKey(previousAppointment));
    } else {
      const createdAppointment = handleAppointmentCreate(appointment);
      persistedAppointment = createdAppointment;
      updateActiveCalendarDate(createdAppointment.date);
      setCalendarAppointmentFocus({
        appointmentKey: appointmentKey(createdAppointment),
        date: createdAppointment.date,
        routeDate: selectedCalendarRouteDate,
      });
    }

    const result = await persistAppointmentRecord(
      persistedAppointment,
      previousAppointment ? "appointment.update" : "appointment.create",
      previousAppointment ?? persistedAppointment,
      options,
    );

    if (!result.ok) {
      if (previousAppointment) {
        handleAppointmentUpdate(previousAppointment, appointmentKey(persistedAppointment));
      } else {
        setCalendarAppointments((current) =>
          current.filter((candidate) => appointmentKey(candidate) !== appointmentKey(persistedAppointment)),
        );
      }
    } else if (result.version) {
      handleAppointmentUpdate(
        { ...persistedAppointment, version: result.version },
        appointmentKey(persistedAppointment),
      );
    }

    return result;
  }

  async function saveCalendarAppointmentInline(
    appointment: Appointment,
    action: AdminAuditAction = "appointment.update",
    originalAppointment?: Appointment,
    options: { notifyClient: boolean } = { notifyClient: true },
  ): Promise<CalendarAppointmentSaveResult> {
    const previousAppointment =
      originalAppointment ??
      calendarAppointments.find((candidate) => appointmentKey(candidate) === appointmentKey(appointment));
    handleAppointmentUpdate(appointment, appointmentKey(previousAppointment ?? appointment));
    const result = await persistAppointmentRecord(
      appointment,
      action,
      previousAppointment ?? appointment,
      options,
    );

    if (!result.ok && previousAppointment) {
      handleAppointmentUpdate(previousAppointment, appointmentKey(appointment));
    } else if (result.ok && result.version) {
      handleAppointmentUpdate({ ...appointment, version: result.version }, appointmentKey(appointment));
    }

    return result;
  }

  async function cancelCalendarAppointment(
    appointment: Appointment,
    options: { notifyClient: boolean },
  ): Promise<CalendarAppointmentSaveResult> {
    const cancelledAppointment = { ...appointment, status: "Отменена" as const };
    handleAppointmentUpdate(cancelledAppointment);
    const result = await persistAppointmentRecord(cancelledAppointment, "appointment.cancel", appointment, options);

    if (!result.ok) {
      handleAppointmentUpdate(appointment, appointmentKey(cancelledAppointment));
    } else if (result.version) {
      handleAppointmentUpdate({ ...cancelledAppointment, version: result.version });
    }

    return result;
  }

  async function deleteCalendarAppointment(
    appointment: Appointment,
  ): Promise<CalendarAppointmentSaveResult> {
    if (!appointment.id) {
      return { message: "Запись без идентификатора нельзя удалить.", ok: false };
    }

    const result = await persistAdminDelete({
      id: appointment.id,
      type: "appointment",
      version: appointment.version ?? 1,
    });
    if (!result.ok) return result;

    setCalendarAppointments((current) =>
      current.filter((candidate) => appointmentKey(candidate) !== appointmentKey(appointment)),
    );
    return result;
  }

  async function deleteClientRecord(client: ClientRecord): Promise<CalendarAppointmentSaveResult> {
    const result = await persistAdminDelete({ id: client.id, type: "client" });
    if (!result.ok) return result;

    setClients((current) => current.filter((candidate) => candidate.id !== client.id));
    setCertificates((current) => current.map((certificate) => (
      certificate.clientId === client.id
        ? { ...certificate, clientId: undefined }
        : certificate
    )));
    return result;
  }

  function saveClientNote(clientIdentity: string, note: string) {
    const previousClients = clients;
    const updatedClient = clients.find((client) => matchesClientIdentity(client, clientIdentity));
    setClients((current) =>
      current.map((client) => (matchesClientIdentity(client, clientIdentity) ? { ...client, note } : client)),
    );

    if (updatedClient) {
      const clientNoteRecord = { ...updatedClient, note };
      delete clientNoteRecord.careEmailConsentAt;
      delete clientNoteRecord.careEmailConsentSource;
      delete clientNoteRecord.careEmailExpectedConsentAt;
      delete clientNoteRecord.careEmailExpectedConsentSource;
      delete clientNoteRecord.careEmailExpectedWithdrawnAt;
      delete clientNoteRecord.careEmailWithdrawnAt;
      void persistAdminRecord({ record: clientNoteRecord, type: "client" }).then((result) => {
        const serverClient = result.client;
        if (!result.ok) {
          setClients(
            serverClient
              ? previousClients.map((client) =>
                  client.id === serverClient.id ? serverClient : client,
                )
              : previousClients,
          );
        } else if (serverClient) {
          setClients((current) =>
            current.map((client) =>
              client.id === serverClient.id ? serverClient : client,
            ),
          );
        }
      });
    }
  }

  function saveClientRecord(client: ClientRecord, originalClientIdentity?: string) {
    const previousClients = clients;
    const hasCareEmailConsentMutation =
      client.careEmailExpectedConsentAt !== undefined ||
      client.careEmailExpectedConsentSource !== undefined ||
      client.careEmailExpectedWithdrawnAt !== undefined;
    const clientForState = { ...client };
    delete clientForState.careEmailExpectedConsentAt;
    delete clientForState.careEmailExpectedConsentSource;
    delete clientForState.careEmailExpectedWithdrawnAt;
    setClients((current) => {
      const uniqueCurrent = [...new Map(current.map((currentClient) => [currentClient.id, currentClient])).values()];
      const nextPhone = normalizeClientPhone(client.phone);
      const existingIndex = uniqueCurrent.findIndex((currentClient) => {
        if (currentClient.id === client.id) {
          return true;
        }

        if (originalClientIdentity) {
          return matchesClientIdentity(currentClient, originalClientIdentity);
        }

        return Boolean(nextPhone) && normalizeClientPhone(currentClient.phone) === nextPhone;
      });

      if (existingIndex === -1) {
        return [...uniqueCurrent, clientForState];
      }

      return uniqueCurrent.map((currentClient, index) => {
        if (index !== existingIndex) return currentClient;
        if (hasCareEmailConsentMutation) return clientForState;

        return {
          ...clientForState,
          careEmailConsentAt: currentClient.careEmailConsentAt,
          careEmailConsentSource: currentClient.careEmailConsentSource,
          careEmailWithdrawnAt: currentClient.careEmailWithdrawnAt,
        };
      });
    });
    void persistAdminRecord({ record: client, type: "client" }).then((result) => {
      const serverClient = result.client;
      if (!result.ok) {
        setClients(
          serverClient
            ? previousClients.map((currentClient) =>
                currentClient.id === serverClient.id ? serverClient : currentClient,
              )
            : previousClients,
        );
      } else if (serverClient) {
        setClients((current) =>
          current.map((currentClient) =>
            currentClient.id === serverClient.id ? serverClient : currentClient,
          ),
        );
      }
    });
  }

  function saveCertificateRecord(certificate: CertificateRecord, originalCode?: string) {
    const previousCertificates = certificates;
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
    void persistAdminRecord({ record: certificate, type: "certificate" }).then((result) => {
      if (!result.ok) setCertificates(previousCertificates);
    });
  }

  function updateCertificateStatus(certificateCode: string, status: CertificateStatus, historyEntry: string) {
    const previousCertificates = certificates;
    const updatedCertificate = certificates.find((certificate) => normalizeSearch(certificate.code) === normalizeSearch(certificateCode));

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

    if (updatedCertificate) {
      void persistAdminRecord({
        record: {
          ...updatedCertificate,
          history: [historyEntry, ...updatedCertificate.history],
          status,
        },
        type: "certificate",
      }).then((result) => {
        if (!result.ok) setCertificates(previousCertificates);
      });
    }
  }

  function saveServiceRecord(service: ServiceRecord, originalSlug?: string) {
    const previousPrices = prices;
    const previousServices = services;
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
    void persistAdminRecord({ audit: { action: "service.visibility" }, record: service, type: "service" }).then((result) => {
      if (!result.ok) {
        setPrices(previousPrices);
        setServices(previousServices);
      }
    });
  }

  function savePriceRecord(price: PriceRecord, originalId?: string) {
    const previousPrices = prices;
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
    void persistAdminRecord({ record: price, type: "price" }).then((result) => {
      if (!result.ok) setPrices(previousPrices);
    });
  }

  async function cleanupUploadedMedia(path?: string) {
    if (!path) return;

    await fetch("/api/admin/media", {
      body: JSON.stringify({ path }),
      headers: await getAdminApiHeaders(),
      method: "DELETE",
    }).catch(() => undefined);
  }

  async function saveMediaRecord(mediaRecord: MediaRecord, originalId?: string, cleanupPath?: string) {
    const previousMedia = media;
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
    const result = await persistAdminRecord({ audit: { action: "media.asset" }, record: mediaRecord, type: "media" });
    if (!result.ok) {
      setMedia(previousMedia);
      await cleanupUploadedMedia(cleanupPath);
      throw new Error(result.message);
    }
  }

  function saveContactSettingsRecord(settings: ContactSettingsRecord) {
    const previousContactChannels = contactChannels;
    const previousContactSettings = contactSettings;
    const linkedChannelValues = new Map([
      ["contact-phone", settings.phone],
      ["contact-email", settings.email],
      ["contact-map", settings.mapUrl],
      ["contact-studio24", settings.bookingUrl],
    ]);
    const nextContactChannels = contactChannels.map((channel) => {
      const linkedValue = linkedChannelValues.get(channel.id);

      return linkedValue === undefined ? channel : { ...channel, value: linkedValue };
    });

    setContactSettings(settings);
    setContactChannels(nextContactChannels);
    setIsContactSettingsOpen(false);
    void persistAdminRecord({ record: settings, type: "contactSettings" }).then((result) => {
      if (!result.ok) {
        setContactChannels(previousContactChannels);
        setContactSettings(previousContactSettings);
        showPersistenceStatus("Не удалось сохранить контакты. Исходные данные восстановлены.");
      } else {
        showPersistenceStatus("Контакты и график сохранены. Публичный сайт обновлён.");
      }
    });
  }

  function saveContactChannelRecord(channel: ContactChannelRecord, originalId?: string) {
    const previousContactChannels = contactChannels;
    const previousContactSettings = contactSettings;
    const updatesPrimaryPhone = channel.id === "contact-phone" && channel.type === "Телефон";
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
    if (updatesPrimaryPhone) {
      setContactSettings((current) => ({ ...current, phone: channel.value }));
    }
    void persistAdminRecord({ record: channel, type: "contactChannel" }).then((result) => {
      if (!result.ok) {
        setContactChannels(previousContactChannels);
        setContactSettings(previousContactSettings);
      } else if (updatesPrimaryPhone) {
        showPersistenceStatus("Телефон сохранён. Публичный сайт обновлён.");
      }
    });
  }

  async function saveBlogPostRecord(post: BlogPostRecord, originalId?: string) {
    const originalKey = normalizeSearch(originalId ?? post.id);
    const previousPost = blogPosts.find(
      (currentPost) => normalizeSearch(currentPost.id) === originalKey,
    );
    setBlogPosts((current) => {
      const priorKey = originalId ? normalizeSearch(originalId) : "";
      const nextKey = normalizeSearch(post.id);
      const existingIndex = current.findIndex((currentPost) => {
        if (priorKey) {
          return normalizeSearch(currentPost.id) === priorKey;
        }

        return normalizeSearch(currentPost.id) === nextKey;
      });

      if (existingIndex === -1) {
        return [...current, post];
      }

      return current.map((currentPost, index) => (index === existingIndex ? post : currentPost));
    });
    const result = await persistAdminRecord({ audit: { action: "blog.publication" }, record: post, type: "blogPost" });
    if (!result.ok) {
      const failedPostSnapshot = JSON.stringify(post);
      setBlogPosts((current) => {
        const failedIndex = current.findIndex(
          (currentPost) => normalizeSearch(currentPost.id) === normalizeSearch(post.id),
        );
        if (
          failedIndex === -1 ||
          JSON.stringify(current[failedIndex]) !== failedPostSnapshot
        ) {
          return current;
        }
        if (!previousPost) {
          return current.filter((_, index) => index !== failedIndex);
        }
        return current.map((currentPost, index) =>
          index === failedIndex ? previousPost : currentPost,
        );
      });
      throw new Error(result.message);
    }
  }

  function saveAdminUserRecord(user: AdminUserRecord, originalId?: string) {
    const previousAdminUsers = adminUsers;
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

    if (!originalId) {
      const draftUserId = user.id;

      void persistAdminUserAction({
        action: "invite",
        user: {
          accessNote: user.accessNote,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }).then((result) => {
        if (isSupabaseBacked && !result?.ok) {
          setAdminUsers(previousAdminUsers);
          return;
        }

        if (!result?.userId || result.userId === draftUserId) {
          return;
        }

        const persistedUserId = result.userId;

        setAdminUsers((current) =>
          current.map((currentUser) => (currentUser.id === draftUserId ? { ...currentUser, id: persistedUserId } : currentUser)),
        );
      });
      return;
    }

    if (isSupabaseAuthUserId(user.id)) {
      void persistAdminUserAction({
        action: "updateProfile",
        user: {
          accessNote: user.accessNote,
          email: user.email,
          id: user.id,
          name: user.name,
          role: user.role,
          status: user.status,
        },
      }).then((result) => {
        if (isSupabaseBacked && !result?.ok) setAdminUsers(previousAdminUsers);
      });
    }
  }

  function saveSettingsRecord(nextSettings: SettingsRecord) {
    const previousSettings = settings;
    setSettings(nextSettings);
    setIsSettingsEditOpen(false);
    void persistAdminRecord({ audit: { action: "site.gift_certificates" }, record: nextSettings, type: "settings" }).then((result) => {
      if (!result.ok) setSettings(previousSettings);
    });
  }

  async function saveBlogVisibility(enabled: boolean) {
    const previousSettings = settings;
    setSettings((current) => ({ ...current, blogEnabled: enabled }));
    const result = await persistAdminRecord({
      audit: { action: "site.blog_visibility" },
      record: { enabled },
      type: "blogVisibility",
    });

    if (!result.ok) {
      setSettings(previousSettings);
      return false;
    }

    return true;
  }

  return (
    <div className="admin-shell">
      <AdminMobileHeader
        activeModule={activeModule}
        brandHref={`/admin?role=${role}`}
        brandLabel="Magic Massage Natali, главная админки"
        closeMenuLabel="Закрыть меню админки"
        isNavigationOpen={isMobileNavigationOpen}
        navigationId="admin-mobile-navigation"
        onMenuToggle={() => setIsMobileNavigationOpen((current) => !current)}
        openMenuLabel="Открыть меню админки"
      />
      <AdminMobileNavigation
        activeSection={activeSection}
        ariaLabel="Разделы админки"
        closeLabel="Закрыть меню админки"
        getHref={(section) => `/admin?section=${section}&role=${role}`}
        heading="Разделы"
        id="admin-mobile-navigation"
        isOpen={isMobileNavigationOpen}
        navigation={navigation}
        onClose={() => setIsMobileNavigationOpen(false)}
      />
      <aside className="admin-sidebar">
        <Link className="admin-brand" href={`/admin?role=${role}`} aria-label="Magic Massage Natali admin home" prefetch={false}>
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
                    prefetch={false}
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
              placeholder={role === "specialist" ? "Клиент, услуга, время" : "Клиент, сертификат, платеж"}
              type="search"
              value={query}
            />
          </div>
          <div className="admin-user-chip" aria-label="Текущая роль и профиль">
            <span>{roleLabels[role]}</span>
            <strong>Профиль</strong>
            <button className="admin-logout-button" onClick={handleLogout} type="button">
              Sign out
            </button>
          </div>
        </header>

        <section className="admin-page-head" aria-labelledby="admin-page-title">
          <div>
            <span className="admin-kicker">{activeModule.group}</span>
            <h1 id="admin-page-title">{activeModule.title}</h1>
            <p>{activeDescription}</p>
          </div>
          {activeModule.primaryAction && canUsePrimaryAction ? (
            <button onClick={openPrimaryAction} type="button">
              {activeModule.primaryAction}
            </button>
          ) : null}
        </section>

        {persistenceStatus ? (
          <p
            className={`admin-export-notice${persistenceStatusVariant === "error" ? " is-error" : ""}`}
            role={persistenceStatusVariant === "error" ? "alert" : "status"}
          >
            {persistenceStatus}
          </p>
        ) : null}

        <AdminSecurityAlerts
          enabled={
            isSupabaseBacked &&
            activeSection === "dashboard" &&
            (role === "owner" || role === "administrator")
          }
        />

        <Workspace
          activeTimeSelection={calendarTimeSelection}
          actorUserId={actorUserId}
          adminUsers={adminUsers}
          appointments={calendarAppointments}
          blogPosts={blogPosts}
          calendarBlocks={calendarBlocks}
          calendarAppointmentFocus={activeCalendarAppointmentFocus}
          certificates={certificates}
          clients={clients}
          currentSpecialistId={initialData?.currentSpecialistId}
          contactChannels={contactChannels}
          contactSettings={contactSettings}
          financeRows={stripeSales}
          hasLoadError={Boolean(initialData?.loadError)}
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
          onCreateCalendarBlock={openCalendarBlockCreate}
          onCreateWalkIn={openCurrentClientBlock}
          onDeleteCalendarBlock={deleteCalendarBlock}
          onDeleteAppointment={openAppointmentDelete}
          onDeleteClient={deleteClientRecord}
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
          onEditCalendarBlock={openCalendarBlockEdit}
          onAppointmentPublicEmailCorrected={handleAppointmentPublicEmailCorrected}
          onSaveAppointment={saveCalendarAppointmentInline}
          onOpenSettingsEdit={() => setIsSettingsEditOpen(true)}
          onSaveAdminUser={saveAdminUserRecord}
          onSaveBlogPost={saveBlogPostRecord}
          onSaveBlogVisibility={saveBlogVisibility}
          onSaveCertificate={saveCertificateRecord}
          onSaveClient={saveClientRecord}
          onSaveClientNote={saveClientNote}
          onSaveContactChannel={saveContactChannelRecord}
          onSaveContactSettings={saveContactSettingsRecord}
          onSaveMedia={saveMediaRecord}
          onSavePrice={savePriceRecord}
          onSaveService={saveServiceRecord}
          onSaveSpecialistSchedule={saveSpecialistSchedule}
          onSelectTimeRange={openCalendarTimeSelection}
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
          showGiftReconciliation={
            isSupabaseBacked && (role === "owner" || role === "administrator")
          }
          specialists={specialists}
        />

        {calendarTimeSelection ? (
          <CalendarTimeSelectionDialog
            onChooseAppointment={createAppointmentFromTimeSelection}
            onChooseBlock={createBlockFromTimeSelection}
            onClose={() => setCalendarTimeSelection(undefined)}
            selection={calendarTimeSelection}
          />
        ) : null}

        {isCalendarActionDialogOpen ? (
          <CalendarAppointmentDialog
            appointments={calendarAppointments}
            bookingBufferMinutes={settings.bookingBufferMinutes}
            calendarBlocks={calendarBlocks}
            clients={clients}
            currentSpecialistId={initialData?.currentSpecialistId}
            initialAppointment={editingAppointment}
            key={calendarDialogKey}
            onClose={closeActionDialog}
            onSave={saveCalendarAppointment}
            prefillClient={prefilledCalendarClient}
            prefillClientName={shouldPrefillCalendarClient ? selectedClientName : undefined}
            prefillDate={editingAppointment ? undefined : appointmentCreateSelection?.date ?? activeCalendarDate}
            prefillDurationMinutes={editingAppointment ? undefined : appointmentCreateSelection?.durationMinutes}
            prefillSpecialistId={editingAppointment ? undefined : appointmentCreateSelection?.specialistId}
            prefillTime={editingAppointment ? undefined : appointmentCreateSelection?.startsAt}
            requireSpecialistSelection={Boolean(
              appointmentCreateSelection
              && !appointmentCreateSelection.specialistId
              && specialists.filter((specialist) => specialist.status === "active").length > 1
            )}
            role={role}
            siteSettings={settings}
            specialists={specialists}
          />
        ) : isActionOpen && activeModule.primaryAction ? (
          <QuickActionDialog
            action={activeModule.primaryAction}
            moduleTitle={activeModule.title}
            onClose={closeActionDialog}
          />
        ) : null}

        {isCalendarBlockDialogOpen ? (
          <CalendarBlockDialog
            appointments={calendarAppointments}
            bookingBufferMinutes={settings.bookingBufferMinutes}
            calendarBlocks={calendarBlocks}
            currentSpecialistId={initialData?.currentSpecialistId}
            initialBlock={editingCalendarBlock}
            initialDate={calendarBlockDate || activeCalendarDate}
            initialEndsAt={calendarBlockEndsAt}
            initialSpecialistId={calendarBlockSpecialistId}
            initialStartsAt={calendarBlockStartsAt}
            intent={calendarBlockIntent}
            key={editingCalendarBlock?.id ?? `new-${calendarBlockIntent}-${calendarBlockDate || activeCalendarDate}`}
            onClose={closeCalendarBlockDialog}
            onSave={saveCalendarBlock}
            role={role}
            requireSpecialistSelection={Boolean(
              calendarBlockStartsAt
              && !calendarBlockSpecialistId
              && specialists.filter((specialist) => specialist.status === "active").length > 1
            )}
            specialists={specialists}
          />
        ) : null}
        {cancellingAppointment ? (
          <CalendarAppointmentCancelDialog
            appointment={cancellingAppointment}
            clientEmail={getAppointmentNotificationEmail(clients, cancellingAppointment)}
            onClose={closeCancelDialog}
            onConfirm={cancelCalendarAppointment}
          />
        ) : null}
        {deletingAppointment ? (
          <AdminRecordDeleteDialog
            confirmLabel="Удалить запись"
            description="Это не отмена: CRM-запись будет удалена без возможности восстановления. Отдельное письмо об удалении не отправляется, а ожидающие уведомления будут отменены."
            kicker="Календарь"
            onClose={closeAppointmentDeleteDialog}
            onConfirm={() => deleteCalendarAppointment(deletingAppointment)}
            subject={`${deletingAppointment.client}, ${formatCalendarDay(deletingAppointment.date)} в ${deletingAppointment.time}`}
            summaryItems={[deletingAppointment.service, deletingAppointment.status]}
            title="Удалить запись?"
          />
        ) : null}
      </main>
    </div>
  );
}
