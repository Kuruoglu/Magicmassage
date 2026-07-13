import { resolveAdminSection, type AdminRoleId } from "./config";

type QueryParams = Record<string, string | string[] | undefined>;

type AdminCalendarAction = "create";

export type AdminShellSelection = {
  activeSection: ReturnType<typeof resolveAdminSection>;
  calendarAction?: AdminCalendarAction;
  role: AdminRoleId;
  selectedAdminUserId?: string;
  selectedAppointmentKey?: string;
  selectedBlogPostId?: string;
  selectedCalendarDate?: string;
  selectedCertificateCode?: string;
  selectedClientName?: string;
  selectedContactId?: string;
  selectedMediaId?: string;
  selectedPriceId?: string;
  selectedServiceSlug?: string;
  selectedSettingsGroupId?: string;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveAdminShellSelection(query: QueryParams, role: AdminRoleId): AdminShellSelection {
  const activeSection = resolveAdminSection(firstQueryValue(query.section), role);

  return {
    activeSection,
    calendarAction: firstQueryValue(query.action) === "create" ? "create" : undefined,
    role,
    selectedAdminUserId: firstQueryValue(query.user),
    selectedAppointmentKey: firstQueryValue(query.appointment),
    selectedBlogPostId: firstQueryValue(query.blog),
    selectedCalendarDate: firstQueryValue(query.date),
    selectedCertificateCode: firstQueryValue(query.certificate),
    selectedClientName: firstQueryValue(query.client),
    selectedContactId: firstQueryValue(query.contact),
    selectedMediaId: firstQueryValue(query.media),
    selectedPriceId: firstQueryValue(query.price),
    selectedServiceSlug: firstQueryValue(query.service),
    selectedSettingsGroupId: firstQueryValue(query.settings),
  };
}
