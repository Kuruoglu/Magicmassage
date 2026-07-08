import { AdminShell } from "@/components/admin/admin-shell";
import { resolveAdminRole, resolveAdminSection } from "@/admin/config";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const query = await searchParams;
  const role = resolveAdminRole(firstQueryValue(query.role));
  const activeSection = resolveAdminSection(firstQueryValue(query.section), role);
  const calendarAction = firstQueryValue(query.action) === "create" ? "create" : undefined;
  const selectedAppointmentKey = firstQueryValue(query.appointment);
  const selectedCalendarDate = firstQueryValue(query.date);
  const selectedCertificateCode = firstQueryValue(query.certificate);
  const selectedClientName = firstQueryValue(query.client);
  const selectedServiceSlug = firstQueryValue(query.service);

  return (
    <AdminShell
      activeSection={activeSection}
      calendarAction={calendarAction}
      role={role}
      selectedAppointmentKey={selectedAppointmentKey}
      selectedCalendarDate={selectedCalendarDate}
      selectedCertificateCode={selectedCertificateCode}
      selectedClientName={selectedClientName}
      selectedServiceSlug={selectedServiceSlug}
    />
  );
}
