import type { Appointment, CertificateRecord, ClientRecord } from "./domain";
import { createAdminSupabaseRepository, type AdminRepository, type AdminSupabaseClient } from "./repository";
import { createAdminSupabaseClient, type AdminSupabaseEnvSource } from "./supabase-client";

export type AdminPersistInput =
  | {
      record: Appointment;
      type: "appointment";
    }
  | {
      record: CertificateRecord;
      type: "certificate";
    }
  | {
      record: ClientRecord;
      type: "client";
    };

export type AdminPersistResult =
  | {
      mode: "supabase";
      ok: true;
    }
  | {
      message: string;
      mode: "demo" | "supabase";
      ok: false;
    };

type AdminPersistDependencies = {
  createClient?: (env?: AdminSupabaseEnvSource) => AdminSupabaseClient | null;
  createRepository?: (client: AdminSupabaseClient) => Pick<AdminRepository, "saveAppointment" | "saveCertificate" | "saveClient">;
  env?: AdminSupabaseEnvSource;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string";
}

function hasNumber(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" && Number.isFinite(value[key]);
}

function hasStringArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]) && value[key].every((item) => typeof item === "string");
}

function hasArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]);
}

function isClientRecordShape(record: Record<string, unknown>) {
  return (
    hasString(record, "email") &&
    hasArray(record, "history") &&
    hasString(record, "id") &&
    hasString(record, "language") &&
    hasString(record, "name") &&
    hasString(record, "next") &&
    hasString(record, "note") &&
    hasString(record, "phone") &&
    hasString(record, "preferredContact") &&
    hasString(record, "status") &&
    hasString(record, "telegram") &&
    hasString(record, "totalSpend") &&
    hasNumber(record, "visits") &&
    hasStringArray(record, "tags")
  );
}

function isAppointmentRecordShape(record: Record<string, unknown>) {
  return (
    hasString(record, "client") &&
    hasString(record, "clientId") &&
    hasString(record, "date") &&
    hasString(record, "note") &&
    hasString(record, "service") &&
    hasString(record, "status") &&
    hasString(record, "time")
  );
}

function isCertificateRecordShape(record: Record<string, unknown>) {
  const clientId = record.clientId;

  return (
    hasString(record, "amount") &&
    hasString(record, "buyer") &&
    (clientId === undefined || typeof clientId === "string") &&
    hasString(record, "clientName") &&
    hasString(record, "code") &&
    hasString(record, "expiresAt") &&
    hasStringArray(record, "history") &&
    hasString(record, "note") &&
    hasString(record, "paymentDate") &&
    hasString(record, "recipient") &&
    hasString(record, "status") &&
    hasString(record, "stripeId")
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to persist admin record.";
}

export function isAdminPersistInput(input: unknown): input is AdminPersistInput {
  if (!isObjectRecord(input) || !isObjectRecord(input.record)) {
    return false;
  }

  if (input.type === "appointment") {
    return isAppointmentRecordShape(input.record);
  }

  if (input.type === "certificate") {
    return isCertificateRecordShape(input.record);
  }

  if (input.type === "client") {
    return isClientRecordShape(input.record);
  }

  return false;
}

export async function persistAdminRecord(
  input: AdminPersistInput,
  {
    createClient = createAdminSupabaseClient,
    createRepository = createAdminSupabaseRepository,
    env = process.env,
  }: AdminPersistDependencies = {},
): Promise<AdminPersistResult> {
  const client = createClient(env);

  if (!client) {
    return {
      message: "Supabase is not configured.",
      mode: "demo",
      ok: false,
    };
  }

  try {
    const repository = createRepository(client);

    if (input.type === "client") {
      await repository.saveClient(input.record);
    } else if (input.type === "certificate") {
      await repository.saveCertificate(input.record);
    } else {
      await repository.saveAppointment(input.record);
    }

    return {
      mode: "supabase",
      ok: true,
    };
  } catch (error) {
    return {
      message: errorMessage(error),
      mode: "supabase",
      ok: false,
    };
  }
}
