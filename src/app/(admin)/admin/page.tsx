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
  const selectedClientName = firstQueryValue(query.client);

  return (
    <AdminShell
      activeSection={activeSection}
      calendarAction={calendarAction}
      role={role}
      selectedClientName={selectedClientName}
    />
  );
}
