create or replace view public.admin_public_business_details
with (security_invoker = false, security_barrier = true)
as
select
  settings.id,
  settings.business_name,
  settings.phone,
  settings.address,
  settings.seo_area,
  settings.working_schedule,
  settings.updated_at,
  settings.email
from public.admin_contact_settings settings
where settings.id = 'site';

revoke all on public.admin_public_business_details from public;
grant select on public.admin_public_business_details to anon, authenticated, service_role;

comment on view public.admin_public_business_details is
  'Narrow public projection for the business name, phone, email, address, and footer working schedule.';
