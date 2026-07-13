export type AdminRoleId = "owner" | "administrator" | "specialist" | "editor" | "accountant" | "viewer";

export type AdminSectionId =
  | "dashboard"
  | "clients"
  | "users"
  | "certificates"
  | "calendar"
  | "services"
  | "price"
  | "media"
  | "contacts"
  | "blog"
  | "finances"
  | "settings";

export type AdminModule = {
  id: AdminSectionId;
  title: string;
  group: "Операции" | "Контент" | "Финансы" | "Система";
  primaryAction: string;
  description: string;
};

export type FinanceRow = {
  id?: string;
  date?: string;
  certificateCode?: string;
  buyer?: string;
  status?: "Оплачено" | "Возврат" | "Частичный возврат";
  gross: number;
  stripeFee: number;
  refund: number;
};

export type FinanceSummary = {
  gross: number;
  refunds: number;
  stripeFees: number;
  net: number;
  payments: number;
};

export const accountantRoleId = "accountant" satisfies AdminRoleId;

export const adminModules: AdminModule[] = [
  {
    id: "dashboard",
    title: "Дашборд",
    group: "Операции",
    primaryAction: "Создать запись",
    description: "Операционный обзор записей, заявок, ближайших визитов и сертификатов.",
  },
  {
    id: "clients",
    title: "Клиенты",
    group: "Операции",
    primaryAction: "Добавить клиента",
    description: "Контакты, язык общения, история визитов, сертификаты, заметки и согласия.",
  },
  {
    id: "users",
    title: "Пользователи",
    group: "Система",
    primaryAction: "Пригласить",
    description: "Сотрудники, роли, приглашения, блокировки доступа и журнал входов.",
  },
  {
    id: "certificates",
    title: "Сертификаты",
    group: "Операции",
    primaryAction: "Выдать вручную",
    description: "Stripe-оплата, PDF, отправка, повторная отправка и погашение по коду.",
  },
  {
    id: "calendar",
    title: "Календарь",
    group: "Операции",
    primaryAction: "Создать запись",
    description: "День, неделя, список, статусы записей, переносы и отмены.",
  },
  {
    id: "services",
    title: "Виды массажа",
    group: "Контент",
    primaryAction: "Добавить услугу",
    description: "Категории, описания, SEO, фото, длительность и видимость на сайте.",
  },
  {
    id: "price",
    title: "Прайс",
    group: "Контент",
    primaryAction: "Добавить цену",
    description: "Варианты услуг, длительность, цена, валюта, активность и порядок вывода.",
  },
  {
    id: "media",
    title: "Медиа",
    group: "Контент",
    primaryAction: "Загрузить медиа",
    description: "Файлы, папки, alt-тексты, разрешение на публикацию и места использования.",
  },
  {
    id: "contacts",
    title: "Контакты",
    group: "Контент",
    primaryAction: "Сохранить",
    description: "Адрес, телефон, мессенджеры, соцсети, часы работы, карта и LocalBusiness SEO.",
  },
  {
    id: "blog",
    title: "Блог",
    group: "Контент",
    primaryAction: "Новая статья",
    description: "Статьи, категории, теги, авторы, обложки, SEO и локализации.",
  },
  {
    id: "finances",
    title: "Финансы",
    group: "Финансы",
    primaryAction: "Выгрузить отчет",
    description: "Stripe-продажи за период, комиссии, возвраты, net-суммы и audit log.",
  },
  {
    id: "settings",
    title: "Настройки",
    group: "Система",
    primaryAction: "Сохранить",
    description: "Бизнес-информация, запись, платежи, email, privacy/cookies, SEO и роли.",
  },
];

const roleAccess: Record<AdminRoleId, AdminSectionId[]> = {
  owner: adminModules.map((module) => module.id),
  administrator: [
    "dashboard",
    "clients",
    "certificates",
    "calendar",
    "services",
    "price",
    "media",
    "contacts",
    "blog",
    "finances",
  ],
  specialist: ["dashboard", "clients", "certificates", "calendar"],
  editor: ["dashboard", "services", "price", "media", "contacts", "blog"],
  accountant: ["finances"],
  viewer: ["dashboard", "clients", "certificates", "calendar", "services", "price", "media", "contacts", "blog"],
};

export const roleLabels: Record<AdminRoleId, string> = {
  owner: "Владелец",
  administrator: "Администратор",
  specialist: "Специалист",
  editor: "Редактор",
  accountant: "Бухгалтер",
  viewer: "Просмотр",
};

export function resolveAdminRole(role: string | null | undefined): AdminRoleId {
  if (
    role === "owner" ||
    role === "administrator" ||
    role === "specialist" ||
    role === "editor" ||
    role === "accountant" ||
    role === "viewer"
  ) {
    return role;
  }

  return "viewer";
}

export function getAdminNavigationForRole(role: AdminRoleId) {
  const allowed = new Set(roleAccess[role]);

  return adminModules.filter((module) => allowed.has(module.id));
}

export function canAccessAdminSection(section: AdminSectionId, role: AdminRoleId) {
  return roleAccess[role].includes(section);
}

export function resolveAdminSection(section: string | null | undefined, role: AdminRoleId): AdminSectionId {
  const navigation = getAdminNavigationForRole(role);
  const requested = adminModules.find((module) => module.id === section)?.id;

  if (requested && canAccessAdminSection(requested, role)) {
    return requested;
  }

  return navigation[0]?.id ?? "dashboard";
}

export function getAdminModule(section: AdminSectionId) {
  return adminModules.find((module) => module.id === section) ?? adminModules[0];
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFinanceSummary(rows: Pick<FinanceRow, "gross" | "stripeFee" | "refund">[]): FinanceSummary {
  const gross = rows.reduce((sum, row) => sum + row.gross, 0);
  const refunds = rows.reduce((sum, row) => sum + row.refund, 0);
  const stripeFees = rows.reduce((sum, row) => sum + row.stripeFee, 0);

  return {
    gross: roundMoney(gross),
    refunds: roundMoney(refunds),
    stripeFees: roundMoney(stripeFees),
    net: roundMoney(gross - refunds - stripeFees),
    payments: rows.length,
  };
}
