import type { AdminRoleId, AdminSectionId } from "@/admin/config";
import type { Appointment } from "@/admin/domain";

export type SettingsGroupId =
  | "business"
  | "booking"
  | "payments"
  | "email"
  | "privacySeo"
  | "rolesAudit";

export function clientProfileHref(clientIdentity: string, role: AdminRoleId) {
  return `/admin?section=clients&role=${role}&client=${encodeURIComponent(clientIdentity)}`;
}

export function adminSectionHref(section: AdminSectionId, role: AdminRoleId) {
  return `/admin?section=${section}&role=${role}`;
}

export function calendarClientHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=calendar&role=${role}&client=${encodeURIComponent(clientName)}`;
}

export function calendarDateHref(date: string, role: AdminRoleId, clientName?: string) {
  const clientQuery = clientName ? `&client=${encodeURIComponent(clientName)}` : "";

  return `/admin?section=calendar&role=${role}&date=${encodeURIComponent(date)}${clientQuery}`;
}

export function appointmentKey(appointment: Appointment) {
  return appointment.id ?? `${appointment.date}-${appointment.time}-${appointment.client}`;
}

export function calendarAppointmentHref(appointment: Appointment, role: AdminRoleId, clientName?: string) {
  return `${calendarDateHref(appointment.date, role, clientName)}&appointment=${encodeURIComponent(appointmentKey(appointment))}`;
}

export function certificateClientHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=certificates&role=${role}&client=${encodeURIComponent(clientName)}`;
}

export function certificateDetailHref(certificateCode: string, role: AdminRoleId) {
  return `/admin?section=certificates&role=${role}&certificate=${encodeURIComponent(certificateCode)}`;
}

export function serviceDetailHref(serviceSlug: string, role: AdminRoleId) {
  return `/admin?section=services&role=${role}&service=${encodeURIComponent(serviceSlug)}`;
}

export function priceDetailHref(priceId: string, role: AdminRoleId) {
  return `/admin?section=price&role=${role}&price=${encodeURIComponent(priceId)}`;
}

export function mediaDetailHref(mediaId: string, role: AdminRoleId) {
  return `/admin?section=media&role=${role}&media=${encodeURIComponent(mediaId)}`;
}

export function contactDetailHref(contactId: string, role: AdminRoleId) {
  return `/admin?section=contacts&role=${role}&contact=${encodeURIComponent(contactId)}`;
}

export function blogDetailHref(blogPostId: string, role: AdminRoleId) {
  return `/admin?section=blog&role=${role}&blog=${encodeURIComponent(blogPostId)}`;
}

export function settingsDetailHref(settingsGroupId: SettingsGroupId, role: AdminRoleId) {
  return `/admin?section=settings&role=${role}&settings=${encodeURIComponent(settingsGroupId)}`;
}

export function userDetailHref(userId: string, role: AdminRoleId) {
  return `/admin?section=users&role=${role}&user=${encodeURIComponent(userId)}`;
}

export function calendarCreateHref(clientName: string, role: AdminRoleId) {
  return `/admin?section=calendar&role=${role}&client=${encodeURIComponent(clientName)}&action=create`;
}

export function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
