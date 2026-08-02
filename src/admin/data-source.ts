import type { FinanceRow } from "./config";
import type { AdminRoleId, AdminSectionId } from "./config";
import { certificateRows, clientRows, financeRows as demoFinanceRows, upcomingAppointments } from "./demo-data";
import {
  createAdminDemoRecords,
  getLocalDateTimeKey,
  type AdminDomainRecords,
  type AdminUserRecord,
  type BlogPostRecord,
  type ContactChannelRecord,
  type ContactSettingsRecord,
  type MediaRecord,
  type PriceRecord,
  type ServiceRecord,
  type SettingsRecord,
} from "./domain";
import { createAdminSupabaseRepository, type AdminRepository, type AdminSupabaseClient } from "./repository";
import { createAdminSupabaseClient, type AdminSupabaseEnvSource } from "./supabase-client";

export type AdminShellDataSource = "demo" | "supabase";

export type AdminShellInitialData = {
  adminUsers?: AdminUserRecord[];
  blogPosts?: BlogPostRecord[];
  contactChannels?: ContactChannelRecord[];
  contactSettings?: ContactSettingsRecord;
  currentSpecialistId?: string;
  financeRows: FinanceRow[];
  loadError?: string;
  media?: MediaRecord[];
  prices?: PriceRecord[];
  records: AdminDomainRecords;
  services?: ServiceRecord[];
  settings?: SettingsRecord;
  source: AdminShellDataSource;
};

type LoadAdminShellDataOptions = {
  activeSection?: AdminSectionId;
  createClient?: (env?: AdminSupabaseEnvSource) => AdminSupabaseClient | null;
  createRepository?: (
    client: AdminSupabaseClient,
  ) => Pick<
    AdminRepository,
    | "listAppointments"
    | "listAdminUsers"
    | "listBlogPosts"
    | "listCalendarBlocks"
    | "listCertificates"
    | "listClients"
    | "listContactChannels"
    | "listMedia"
    | "listPrices"
    | "listServices"
    | "listSpecialists"
    | "listStripeSales"
    | "loadContactSettings"
    | "loadDomainRecords"
    | "loadSettings"
  >;
  env?: AdminSupabaseEnvSource;
  now?: Date;
  role?: AdminRoleId;
  specialistId?: string;
};

type AdminShellRepository = ReturnType<NonNullable<LoadAdminShellDataOptions["createRepository"]>>;

const emptyRecords: AdminDomainRecords = {
  appointments: [],
  calendarBlocks: [],
  certificates: [],
  clients: [],
};

const contentSections: readonly AdminSectionId[] = ["services", "price", "media", "contacts", "blog"];

function cloneFinanceRows(rows: readonly FinanceRow[]): FinanceRow[] {
  return rows.map((row) => ({ ...row }));
}

function buildDemoRecords() {
  return createAdminDemoRecords({
    appointmentRows: upcomingAppointments,
    certificateRows,
    clientRows,
    financeRows: demoFinanceRows,
  });
}

export function isAdminDemoFallbackAllowed(env: AdminSupabaseEnvSource = process.env) {
  return env.ADMIN_DEMO_FALLBACK_ENABLED === "true" || env.NODE_ENV !== "production";
}

function assertDemoFallbackAllowed(env: AdminSupabaseEnvSource) {
  if (!isAdminDemoFallbackAllowed(env)) {
    throw new Error("Admin demo data is disabled in production.");
  }
}

export function buildDemoAdminShellData(loadError?: string): AdminShellInitialData {
  return {
    financeRows: cloneFinanceRows(demoFinanceRows),
    loadError,
    records: buildDemoRecords(),
    source: "demo",
  };
}

export function getMonthFinancePeriod(now = new Date()) {
  const localDate = getLocalDateTimeKey(now, "Europe/Sofia").slice(0, 10);
  const [year, monthNumber] = localDate.split("-").map(Number);
  const month = monthNumber - 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = String(monthNumber).padStart(2, "0");

  return {
    from: `${year}-${monthLabel}-01`,
    to: `${year}-${monthLabel}-${String(lastDay).padStart(2, "0")}`,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Supabase admin data load error";
}

function withRuntimeEmailSender(
  settings: SettingsRecord | undefined,
  env: AdminSupabaseEnvSource,
) {
  if (!settings) return undefined;
  const verifiedEmailSender = env.RESEND_FROM_EMAIL?.trim();
  return verifiedEmailSender ? { ...settings, verifiedEmailSender } : settings;
}

async function loadFullAccessSectionData(
  repository: AdminShellRepository,
  activeSection: AdminSectionId,
  env: AdminSupabaseEnvSource,
  now: Date,
): Promise<Omit<AdminShellInitialData, "source">> {
  const baseData = {
    financeRows: [],
    records: emptyRecords,
  } satisfies Omit<AdminShellInitialData, "source">;

  if (activeSection === "dashboard") {
    const [appointments, certificates, clients, financeRows, settings] = await Promise.all([
      repository.listAppointments(),
      repository.listCertificates(),
      repository.listClients(),
      repository.listStripeSales(getMonthFinancePeriod(now)),
      repository.loadSettings(),
    ]);

    return {
      ...baseData,
      financeRows,
      records: {
        appointments,
        calendarBlocks: [],
        certificates,
        clients,
        specialists: [],
      },
      settings: withRuntimeEmailSender(settings, env),
    };
  }

  if (activeSection === "clients") {
    const [appointments, certificates, clients, settings] = await Promise.all([
      repository.listAppointments(),
      repository.listCertificates(),
      repository.listClients(),
      repository.loadSettings(),
    ]);

    return {
      ...baseData,
      records: {
        appointments,
        calendarBlocks: [],
        certificates,
        clients,
        specialists: [],
      },
      settings: withRuntimeEmailSender(settings, env),
    };
  }

  if (activeSection === "certificates") {
    const [certificates, clients] = await Promise.all([
      repository.listCertificates(),
      repository.listClients(),
    ]);

    return {
      ...baseData,
      records: {
        appointments: [],
        calendarBlocks: [],
        certificates,
        clients,
        specialists: [],
      },
    };
  }

  if (activeSection === "calendar") {
    const [appointments, calendarBlocks, clients, specialists, settings] = await Promise.all([
      repository.listAppointments(),
      repository.listCalendarBlocks(),
      repository.listClients(),
      repository.listSpecialists(),
      repository.loadSettings(),
    ]);
    const specialistNames = new Map(
      specialists.map((specialist) => [specialist.id, specialist.displayName]),
    );

    return {
      ...baseData,
      records: {
        appointments: appointments.map((appointment) => ({
          ...appointment,
          specialistName: appointment.specialistId
            ? specialistNames.get(appointment.specialistId)
            : undefined,
        })),
        calendarBlocks: calendarBlocks.map((block) => ({
          ...block,
          specialistName: block.specialistId
            ? specialistNames.get(block.specialistId)
            : undefined,
        })),
        certificates: [],
        clients,
        specialists,
      },
      settings: withRuntimeEmailSender(settings, env),
    };
  }

  if (activeSection === "users") {
    return { ...baseData, adminUsers: await repository.listAdminUsers() };
  }

  if (activeSection === "services" || activeSection === "price") {
    const [services, prices] = await Promise.all([
      repository.listServices(),
      repository.listPrices(),
    ]);

    return { ...baseData, prices, services };
  }

  if (activeSection === "media") {
    return { ...baseData, media: await repository.listMedia() };
  }

  if (activeSection === "contacts") {
    const [contactChannels, contactSettings] = await Promise.all([
      repository.listContactChannels(),
      repository.loadContactSettings(),
    ]);

    return { ...baseData, contactChannels, contactSettings };
  }

  if (activeSection === "blog") {
    const [blogPosts, media, settings] = await Promise.all([
      repository.listBlogPosts(),
      repository.listMedia(),
      repository.loadSettings(),
    ]);

    return {
      ...baseData,
      blogPosts,
      media,
      settings: withRuntimeEmailSender(settings, env),
    };
  }

  if (activeSection === "finances") {
    return {
      ...baseData,
      financeRows: await repository.listStripeSales(getMonthFinancePeriod(now)),
    };
  }

  return {
    ...baseData,
    settings: withRuntimeEmailSender(await repository.loadSettings(), env),
  };
}

export async function loadAdminShellData({
  activeSection,
  createClient = createAdminSupabaseClient,
  createRepository = createAdminSupabaseRepository,
  env = process.env,
  now = new Date(),
  role = "owner",
  specialistId,
}: LoadAdminShellDataOptions = {}): Promise<AdminShellInitialData> {
  const client = createClient(env);

  if (!client) {
    assertDemoFallbackAllowed(env);
    return buildDemoAdminShellData();
  }

  try {
    const repository = createRepository(client);

    if (role === "accountant") {
      return {
        financeRows: await repository.listStripeSales(getMonthFinancePeriod(now)),
        records: emptyRecords,
        source: "supabase",
      };
    }

    if (role === "specialist") {
      if (!specialistId) {
        throw new Error("Specialist profile is not linked to a calendar.");
      }
      return {
        currentSpecialistId: specialistId,
        financeRows: [],
        records: await repository.loadDomainRecords(specialistId),
        source: "supabase",
      };
    }

    if (
      (role === "viewer" || role === "editor")
      && activeSection
      && contentSections.includes(activeSection)
    ) {
      return {
        ...(await loadFullAccessSectionData(repository, activeSection, env, now)),
        source: "supabase",
      };
    }

    if (role === "viewer") {
      return {
        blogPosts: activeSection === "blog" ? await repository.listBlogPosts() : undefined,
        contactChannels: activeSection === "contacts" ? await repository.listContactChannels() : undefined,
        contactSettings: activeSection === "contacts" ? await repository.loadContactSettings() : undefined,
        financeRows: [],
        media: activeSection === "media" ? await repository.listMedia() : undefined,
        prices: activeSection === "price" ? await repository.listPrices() : undefined,
        records: ["dashboard", "clients", "certificates", "calendar"].includes(activeSection ?? "")
          ? await repository.loadDomainRecords()
          : emptyRecords,
        services: activeSection === "services" ? await repository.listServices() : undefined,
        settings: activeSection === "blog"
          ? withRuntimeEmailSender(await repository.loadSettings(), env)
          : undefined,
        source: "supabase",
      };
    }

    if (role === "editor") {
      return {
        blogPosts: activeSection === "blog" ? await repository.listBlogPosts() : undefined,
        contactChannels: activeSection === "contacts" ? await repository.listContactChannels() : undefined,
        contactSettings: activeSection === "contacts" ? await repository.loadContactSettings() : undefined,
        financeRows: [],
        media: activeSection === "media" ? await repository.listMedia() : undefined,
        prices: activeSection === "price" ? await repository.listPrices() : undefined,
        records: emptyRecords,
        services: activeSection === "services" ? await repository.listServices() : undefined,
        settings: activeSection === "blog"
          ? withRuntimeEmailSender(await repository.loadSettings(), env)
          : undefined,
        source: "supabase",
      };
    }

    if (activeSection) {
      const sectionData = await loadFullAccessSectionData(repository, activeSection, env, now);

      return {
        ...sectionData,
        ...(specialistId ? { currentSpecialistId: specialistId } : {}),
        source: "supabase",
      };
    }

    const [
      records,
      financeRows,
      adminUsers,
      blogPosts,
      services,
      prices,
      media,
      contactChannels,
      contactSettings,
      settings,
    ] = await Promise.all([
      repository.loadDomainRecords(),
      repository.listStripeSales(getMonthFinancePeriod(now)),
      repository.listAdminUsers(),
      repository.listBlogPosts(),
      repository.listServices(),
      repository.listPrices(),
      repository.listMedia(),
      repository.listContactChannels(),
      repository.loadContactSettings(),
      repository.loadSettings(),
    ]);

    return {
      adminUsers,
      blogPosts,
      contactChannels,
      contactSettings,
      ...(specialistId ? { currentSpecialistId: specialistId } : {}),
      financeRows,
      media,
      prices,
      records,
      services,
      settings: withRuntimeEmailSender(settings, env),
      source: "supabase",
    };
  } catch (error) {
    assertDemoFallbackAllowed(env);
    return buildDemoAdminShellData(errorMessage(error));
  }
}
