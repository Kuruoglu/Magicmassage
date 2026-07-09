create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.admin_role as enum (
    'owner',
    'administrator',
    'specialist',
    'editor',
    'accountant',
    'viewer'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null default 'viewer',
  display_name text not null,
  email text not null,
  status text not null default 'invited' check (status in ('active', 'invited', 'suspended')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_clients (
  id text primary key,
  full_name text not null,
  phone text not null,
  phone_normalized text not null unique,
  email text,
  locale text not null default 'ru' check (locale in ('bg', 'ru', 'ua', 'en')),
  preferred_contact text not null default 'phone',
  telegram_url text,
  status text not null default 'new',
  visit_count integer not null default 0 check (visit_count >= 0),
  next_visit_label text not null default 'Not scheduled',
  total_spend_label text not null default '0 EUR',
  tags text[] not null default '{}',
  notes text not null default '',
  gdpr_consent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_appointments (
  id text primary key,
  client_id text not null references public.admin_clients(id) on delete restrict,
  starts_on date not null,
  starts_at time not null,
  service_name text not null,
  status text not null default 'pending' check (status in ('confirmed', 'pending', 'request', 'cancelled', 'completed', 'no_show')),
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  buffer_minutes integer not null default 15 check (buffer_minutes >= 0),
  internal_note text not null default '',
  public_note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (starts_on, starts_at)
);

create table if not exists public.admin_certificates (
  code text primary key,
  client_id text references public.admin_clients(id) on delete set null,
  client_name_snapshot text not null,
  buyer_name text not null,
  buyer_email text,
  recipient_name text not null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'EUR' check (currency = upper(currency) and length(currency) = 3),
  status text not null default 'paid' check (status in ('paid', 'sent', 'pending_pdf', 'redeemed', 'refunded')),
  stripe_payment_intent_id text,
  paid_on date,
  expires_on date,
  internal_note text not null default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_stripe_sales (
  payment_intent_id text primary key,
  charge_id text,
  certificate_code text references public.admin_certificates(code) on delete set null,
  buyer_name text not null,
  buyer_email text,
  gross_cents integer not null default 0 check (gross_cents >= 0),
  stripe_fee_cents integer not null default 0 check (stripe_fee_cents >= 0),
  refund_cents integer not null default 0 check (refund_cents >= 0),
  net_cents integer generated always as (gross_cents - stripe_fee_cents - refund_cents) stored,
  currency text not null default 'EUR' check (currency = upper(currency) and length(currency) = 3),
  payment_status text not null,
  paid_at timestamptz not null,
  refunded_at timestamptz,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_finance_export_audit (
  id uuid primary key default gen_random_uuid(),
  downloaded_by uuid not null references auth.users(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  export_format text not null check (export_format in ('csv', 'xlsx', 'pdf')),
  row_count integer not null default 0 check (row_count >= 0),
  gross_cents integer not null default 0,
  refund_cents integer not null default 0,
  stripe_fee_cents integer not null default 0,
  net_cents integer not null default 0,
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_profiles_role_status_idx on public.admin_profiles (role, status);
create index if not exists admin_clients_phone_normalized_idx on public.admin_clients (phone_normalized);
create index if not exists admin_appointments_client_date_idx on public.admin_appointments (client_id, starts_on, starts_at);
create index if not exists admin_certificates_client_idx on public.admin_certificates (client_id);
create index if not exists admin_stripe_sales_paid_at_idx on public.admin_stripe_sales (paid_at);
create index if not exists admin_stripe_sales_certificate_idx on public.admin_stripe_sales (certificate_code);
create index if not exists admin_finance_export_audit_downloaded_by_idx on public.admin_finance_export_audit (downloaded_by, created_at);
create index if not exists admin_audit_log_actor_idx on public.admin_audit_log (actor_user_id, created_at);

create or replace function public.admin_has_role(required_roles public.admin_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.status = 'active'
      and profile.role = any(required_roles)
  );
$$;

create or replace function public.admin_can_manage_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_has_role(array['owner', 'administrator']::public.admin_role[]);
$$;

create or replace function public.admin_can_read_operations()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_has_role(array['owner', 'administrator', 'specialist', 'viewer']::public.admin_role[]);
$$;

create or replace function public.admin_can_read_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.admin_has_role(array['owner', 'administrator', 'accountant']::public.admin_role[]);
$$;

revoke all on function public.admin_has_role(public.admin_role[]) from public;
revoke all on function public.admin_can_manage_operations() from public;
revoke all on function public.admin_can_read_operations() from public;
revoke all on function public.admin_can_read_finance() from public;

grant execute on function public.admin_has_role(public.admin_role[]) to authenticated, service_role;
grant execute on function public.admin_can_manage_operations() to authenticated, service_role;
grant execute on function public.admin_can_read_operations() to authenticated, service_role;
grant execute on function public.admin_can_read_finance() to authenticated, service_role;

alter table public.admin_profiles enable row level security;
alter table public.admin_clients enable row level security;
alter table public.admin_appointments enable row level security;
alter table public.admin_certificates enable row level security;
alter table public.admin_stripe_sales enable row level security;
alter table public.admin_finance_export_audit enable row level security;
alter table public.admin_audit_log enable row level security;

grant select, insert, update, delete on public.admin_profiles to authenticated;
grant select, insert, update, delete on public.admin_clients to authenticated;
grant select, insert, update, delete on public.admin_appointments to authenticated;
grant select, insert, update, delete on public.admin_certificates to authenticated;
grant select, insert, update, delete on public.admin_stripe_sales to authenticated;
grant select, insert on public.admin_finance_export_audit to authenticated;
grant select on public.admin_audit_log to authenticated;

drop policy if exists "admin profiles are visible to admins and self" on public.admin_profiles;
create policy "admin profiles are visible to admins and self"
on public.admin_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.admin_has_role(array['owner', 'administrator']::public.admin_role[])
);

drop policy if exists "owner can manage admin profiles" on public.admin_profiles;
create policy "owner can manage admin profiles"
on public.admin_profiles
for all
to authenticated
using (public.admin_has_role(array['owner']::public.admin_role[]))
with check (public.admin_has_role(array['owner']::public.admin_role[]));

drop policy if exists "operations roles can read admin clients" on public.admin_clients;
create policy "operations roles can read admin clients"
on public.admin_clients
for select
to authenticated
using (public.admin_can_read_operations());

drop policy if exists "owner and administrator can manage admin clients" on public.admin_clients;
create policy "owner and administrator can manage admin clients"
on public.admin_clients
for all
to authenticated
using (public.admin_can_manage_operations())
with check (public.admin_can_manage_operations());

drop policy if exists "operations roles can read appointments" on public.admin_appointments;
create policy "operations roles can read appointments"
on public.admin_appointments
for select
to authenticated
using (public.admin_can_read_operations());

drop policy if exists "owner administrator and specialist can manage appointments" on public.admin_appointments;
create policy "owner administrator and specialist can manage appointments"
on public.admin_appointments
for all
to authenticated
using (public.admin_has_role(array['owner', 'administrator', 'specialist']::public.admin_role[]))
with check (public.admin_has_role(array['owner', 'administrator', 'specialist']::public.admin_role[]));

drop policy if exists "operations roles can read certificates" on public.admin_certificates;
create policy "operations roles can read certificates"
on public.admin_certificates
for select
to authenticated
using (public.admin_can_read_operations());

drop policy if exists "owner and administrator can manage certificates" on public.admin_certificates;
create policy "owner and administrator can manage certificates"
on public.admin_certificates
for all
to authenticated
using (public.admin_can_manage_operations())
with check (public.admin_can_manage_operations());

drop policy if exists "accountant can read stripe sales" on public.admin_stripe_sales;
create policy "accountant can read stripe sales"
on public.admin_stripe_sales
for select
to authenticated
using (public.admin_can_read_finance());

drop policy if exists "owner and administrator can manage stripe sales" on public.admin_stripe_sales;
create policy "owner and administrator can manage stripe sales"
on public.admin_stripe_sales
for all
to authenticated
using (public.admin_can_manage_operations())
with check (public.admin_can_manage_operations());

drop policy if exists "finance users can read export audit" on public.admin_finance_export_audit;
create policy "finance users can read export audit"
on public.admin_finance_export_audit
for select
to authenticated
using (public.admin_can_read_finance());

drop policy if exists "accountant can log finance exports" on public.admin_finance_export_audit;
create policy "accountant can log finance exports"
on public.admin_finance_export_audit
for insert
to authenticated
with check (
  public.admin_can_read_finance()
  and downloaded_by = (select auth.uid())
);

drop policy if exists "owner and administrator can read audit log" on public.admin_audit_log;
create policy "owner and administrator can read audit log"
on public.admin_audit_log
for select
to authenticated
using (public.admin_can_manage_operations());
