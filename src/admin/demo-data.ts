import { calculateFinanceSummary, type AdminSectionId, type FinanceRow } from "./config";

export const dashboardMetrics = [
  { label: "Сегодня", value: "8 записей", tone: "info" },
  { label: "Ждут подтверждения", value: "3 заявки", tone: "warning" },
  { label: "Сертификаты", value: "5 оплачено", tone: "success" },
  { label: "Stripe за месяц", value: "1 240 €", tone: "neutral" },
] as const;

export const upcomingAppointments = [
  { time: "10:00", client: "Анна Петрова", service: "Классический массаж", status: "Подтверждена" },
  { time: "12:30", client: "Мария Иванова", service: "Лимфодренажный массаж", status: "Ожидает" },
  { time: "15:00", client: "Olena K.", service: "Deep tissue massage", status: "Подтверждена" },
  { time: "17:30", client: "Светлана", service: "SPA процедура", status: "Новая заявка" },
] as const;

export const clientRows = [
  { name: "Анна Петрова", phone: "+359 88 111 2233", language: "ru", visits: 7, next: "Сегодня 10:00" },
  { name: "Maria Georgieva", phone: "+359 89 555 0099", language: "bg", visits: 3, next: "12 Jul 14:00" },
  { name: "Olena K.", phone: "+359 87 333 4411", language: "ua", visits: 5, next: "15 Jul 11:30" },
] as const;

export const certificateRows = [
  { code: "MMN-2407-1021", buyer: "Anna P.", recipient: "Elena", amount: "120 €", status: "Оплачено" },
  { code: "MMN-2407-1022", buyer: "Ivan D.", recipient: "Maria", amount: "180 €", status: "Отправлен" },
  { code: "MMN-2407-1023", buyer: "Oksana", recipient: "Self", amount: "250 €", status: "Ожидает PDF" },
] as const;

export const financeRows: FinanceRow[] = [
  {
    id: "pi_3QMMN1021",
    date: "2026-07-01",
    certificateCode: "MMN-2407-1021",
    buyer: "Anna P.",
    status: "Оплачено",
    gross: 250,
    stripeFee: 8.6,
    refund: 0,
  },
  {
    id: "pi_3QMMN1022",
    date: "2026-07-02",
    certificateCode: "MMN-2407-1022",
    buyer: "Ivan D.",
    status: "Частичный возврат",
    gross: 180,
    stripeFee: 6.1,
    refund: 40,
  },
  {
    id: "pi_3QMMN1023",
    date: "2026-07-03",
    certificateCode: "MMN-2407-1023",
    buyer: "Oksana",
    status: "Оплачено",
    gross: 120,
    stripeFee: 4.2,
    refund: 0,
  },
];

export const financeSummary = calculateFinanceSummary(financeRows);

export const sectionSamples: Record<AdminSectionId, string[]> = {
  dashboard: ["Записи сегодня", "Новые заявки", "Сертификаты к отправке", "Stripe-продажи"],
  clients: ["Поиск по имени, телефону и email", "Фильтры по языку и активности", "Заметки отдельно от финансов"],
  users: ["Приглашения", "Роли", "Блокировки", "Журнал входов"],
  certificates: ["PDF", "Повторная отправка", "Погашение", "История действий"],
  calendar: ["День", "Неделя", "Список", "Перенос", "Отмена"],
  services: ["Категории", "SEO", "Фото", "Видимость", "Локализации"],
  price: ["Длительность", "Цена", "Валюта", "Активность", "История цен"],
  media: ["Папки", "Alt-тексты", "Разрешение", "Где используется"],
  contacts: ["Адрес", "Телефон", "Мессенджеры", "Часы работы", "LocalBusiness SEO"],
  blog: ["Черновики", "Публикация", "Запланировано", "Теги", "Локализации"],
  finances: ["Период", "CSV", "XLSX", "PDF", "audit log"],
  settings: ["Запись", "Платежи", "Email", "Privacy", "SEO", "Роли"],
};
