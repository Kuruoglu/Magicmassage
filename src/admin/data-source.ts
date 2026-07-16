import type { FinanceRow } from "./config";
import type { AdminRoleId, AdminSectionId } from "./config";
import { certificateRows, clientRows, financeRows as demoFinanceRows, upcomingAppointments } from "./demo-data";
import {
  createAdminDemoRecords,
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
    | "listAdminUsers"
    | "listBlogPosts"
    | "listContactChannels"
    | "listMedia"
    | "listPrices"
    | "listServices"
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

const emptyRecords: AdminDomainRecords = {
  appointments: [],
  calendarBlocks: [],
  certificates: [],
  clients: [],
};

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
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const monthLabel = String(month + 1).padStart(2, "0");

  return {
    from: `${year}-${monthLabel}-01`,
    to: `${year}-${monthLabel}-${String(lastDay).padStart(2, "0")}`,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Supabase admin data load error";
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
      financeRows,
      media,
      prices,
      records,
      services,
      settings,
      source: "supabase",
    };
  } catch (error) {
    assertDemoFallbackAllowed(env);
    return buildDemoAdminShellData(errorMessage(error));
  }
}
