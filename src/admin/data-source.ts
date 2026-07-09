import type { FinanceRow } from "./config";
import { certificateRows, clientRows, financeRows as demoFinanceRows, upcomingAppointments } from "./demo-data";
import {
  createAdminDemoRecords,
  type AdminDomainRecords,
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
  blogPosts?: BlogPostRecord[];
  contactChannels?: ContactChannelRecord[];
  contactSettings?: ContactSettingsRecord;
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
  createClient?: (env?: AdminSupabaseEnvSource) => AdminSupabaseClient | null;
  createRepository?: (
    client: AdminSupabaseClient,
  ) => Pick<
    AdminRepository,
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
  createClient = createAdminSupabaseClient,
  createRepository = createAdminSupabaseRepository,
  env = process.env,
  now = new Date(),
}: LoadAdminShellDataOptions = {}): Promise<AdminShellInitialData> {
  const client = createClient(env);

  if (!client) {
    return buildDemoAdminShellData();
  }

  try {
    const repository = createRepository(client);
    const [
      records,
      financeRows,
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
      repository.listBlogPosts(),
      repository.listServices(),
      repository.listPrices(),
      repository.listMedia(),
      repository.listContactChannels(),
      repository.loadContactSettings(),
      repository.loadSettings(),
    ]);

    return {
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
    return buildDemoAdminShellData(errorMessage(error));
  }
}
