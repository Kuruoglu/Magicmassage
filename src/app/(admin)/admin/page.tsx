import { AdminShellClient } from "@/components/admin/admin-shell-client";
import { loadAdminShellData } from "@/admin/data-source";
import type { AdminRoleId } from "@/admin/config";
import { resolveAdminShellSelection } from "@/admin/page-access";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import {
  adminAccessTokenCookieName,
  allAdminRoles,
  authorizeSupabaseAdminAccess,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import { isAdminDemoFallbackAllowed } from "@/admin/data-source";

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const query = await searchParams;
  const serviceClient = createSupabaseAdminClient();
  let role: AdminRoleId = "owner";
  let actorUserId: string | undefined;
  let specialistId: string | undefined;

  if (serviceClient) {
    const cookieStore = await cookies();
    const token = cookieStore.get(adminAccessTokenCookieName)?.value;
    const authorization = await authorizeSupabaseAdminAccess(serviceClient, token, {
      allowedRoles: allAdminRoles,
    });

    if (!authorization.ok) {
      if (authorization.statusCode === 401) {
        redirect("/admin/login");
      }

      if (authorization.statusCode === 503) {
        throw new Error("Admin authorization service is temporarily unavailable.");
      }

      forbidden();
    }

    role = authorization.role;
    actorUserId = authorization.userId;
    specialistId = authorization.specialistId;
  } else if (!isAdminDemoFallbackAllowed()) {
    redirect("/admin/login");
  }

  const selection = resolveAdminShellSelection(query, role);
  const initialData = await loadAdminShellData({
    activeSection: selection.activeSection,
    specialistId,
    role,
  });

  return (
    <AdminShellClient
      activeSection={selection.activeSection}
      actorUserId={actorUserId}
      calendarAction={selection.calendarAction}
      initialData={initialData}
      role={role}
      selectedAdminUserId={selection.selectedAdminUserId}
      selectedAppointmentKey={selection.selectedAppointmentKey}
      selectedBlogPostId={selection.selectedBlogPostId}
      selectedCalendarDate={selection.selectedCalendarDate}
      selectedCertificateCode={selection.selectedCertificateCode}
      selectedClientName={selection.selectedClientName}
      selectedContactId={selection.selectedContactId}
      selectedMediaId={selection.selectedMediaId}
      selectedPriceId={selection.selectedPriceId}
      selectedServiceSlug={selection.selectedServiceSlug}
      selectedSettingsGroupId={selection.selectedSettingsGroupId}
    />
  );
}
