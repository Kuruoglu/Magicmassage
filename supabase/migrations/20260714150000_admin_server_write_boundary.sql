-- Keep all administrative mutations behind authenticated server routes using service_role.
revoke insert, update, delete on public.admin_profiles from authenticated;
revoke insert, update, delete on public.admin_clients from authenticated;
revoke insert, update, delete on public.admin_appointments from authenticated;
revoke insert, update, delete on public.admin_certificates from authenticated;
revoke insert, update, delete on public.admin_services from authenticated;
revoke insert, update, delete on public.admin_service_translations from authenticated;
revoke insert, update, delete on public.admin_price_variants from authenticated;
revoke insert, update, delete on public.admin_media_assets from authenticated;
revoke insert, update, delete on public.admin_media_placements from authenticated;
revoke insert, update, delete on public.admin_contact_channels from authenticated;
revoke insert, update, delete on public.admin_contact_settings from authenticated;
revoke insert, update, delete on public.admin_blog_posts from authenticated;
revoke insert, update, delete on public.admin_site_settings from authenticated;
revoke insert, update, delete on public.admin_stripe_sales from authenticated;
revoke insert on public.admin_finance_export_audit from authenticated;

drop policy if exists "owner can manage admin profiles" on public.admin_profiles;
drop policy if exists "owner and administrator can manage admin clients" on public.admin_clients;
drop policy if exists "owner administrator and specialist can manage appointments" on public.admin_appointments;
drop policy if exists "owner and administrator can manage certificates" on public.admin_certificates;
drop policy if exists "editor roles can manage admin services" on public.admin_services;
drop policy if exists "editor roles can manage admin price variants" on public.admin_price_variants;
drop policy if exists "editor roles can manage admin media assets" on public.admin_media_assets;
drop policy if exists "editor roles can manage service translations" on public.admin_service_translations;
drop policy if exists "editor roles can manage media placements" on public.admin_media_placements;
drop policy if exists "editor roles can manage admin contact channels" on public.admin_contact_channels;
drop policy if exists "editor roles can manage admin contact settings" on public.admin_contact_settings;
drop policy if exists "editor roles can manage admin blog posts" on public.admin_blog_posts;
drop policy if exists "owner can manage admin site settings" on public.admin_site_settings;
drop policy if exists "owner and administrator can manage stripe sales" on public.admin_stripe_sales;
drop policy if exists "accountant can log finance exports" on public.admin_finance_export_audit;

-- Uploaded assets are private at the storage layer. The application proxy applies
-- admin authentication or the ready + consent + published-placement checks.
update storage.buckets
set public = false
where id = 'admin-media';

drop policy if exists "public can read admin media" on storage.objects;
drop policy if exists "content roles can upload admin media" on storage.objects;
drop policy if exists "content roles can update admin media" on storage.objects;
drop policy if exists "owners can delete admin media" on storage.objects;
