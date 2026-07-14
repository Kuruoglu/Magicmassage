drop policy if exists "public can read active service prices" on public.admin_price_variants;
create policy "public can read active service prices"
on public.admin_price_variants
for select
to anon
using (
  status = 'active'
  and exists (
    select 1
    from public.admin_services service
    where service.slug = admin_price_variants.service_slug
      and service.status = 'published'
  )
);

grant select (
  id,
  service_slug,
  duration_minutes,
  price_cents,
  currency,
  display_order,
  updated_on
) on public.admin_price_variants to anon;

create or replace view public.admin_published_price_variants
with (security_invoker = true, security_barrier = true)
as
select
  price.id,
  price.service_slug,
  price.duration_minutes,
  price.price_cents,
  price.currency,
  price.display_order,
  price.updated_on
from public.admin_price_variants price
join public.admin_services service on service.slug = price.service_slug
where price.status = 'active'
  and service.status = 'published';

revoke all on public.admin_published_price_variants from public;
grant select on public.admin_published_price_variants to anon, authenticated, service_role;
