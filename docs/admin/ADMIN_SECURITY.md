# Admin Security

Admin access is never derived from query parameters, client state, demo data, or
public Supabase keys.

## Authentication

- `/admin` requires a valid Supabase session.
- Missing session redirects to `/admin/login`.
- Inactive or missing admin profile returns 403.
- The effective role comes only from `admin_profiles`.
- Service-role Supabase clients are server-only.
- Every admin session requires TOTP MFA (`aal2`), regardless of role.
- The password recovery UI accepts only Supabase `PASSWORD_RECOVERY` sessions
  in an isolated, non-persistent client. It challenges an existing verified
  TOTP factor and re-checks `aal2` before submitting the password update.
  Recovery never enrolls a new factor or creates admin cookies.
- Standard Supabase recovery tokens still authorize the public password-update
  API at `aal1`; the UI's TOTP gate cannot make that provider endpoint a trusted
  backend boundary. Admin access remains protected by the existing TOTP factor.
  A future hard requirement that the password update itself be TOTP-gated needs
  a server-owned custom recovery flow and matching email template.
- Supabase Auth must allowlist the exact production and active local
  `/admin/reset-password` URLs, enforce a minimum 12-character password, and set
  the maximum enrolled MFA factors to one. Do not wildcard disposable preview
  domains.
- Suspending a profile denies every application request immediately and also
  bans the Supabase Auth user; reactivation unbans Auth before activating the
  profile.

## Role Matrix

- `owner`: all sections, users, settings, finance, audit.
- `administrator`: operations, content, finance, non-critical settings.
- `accountant`: finance reports and exports only.
- `specialist`: own read-only appointment calendar plus the contact-free
  "Клиент сейчас" action.
- `editor`: public content modules only.
- `viewer`: read-only access to explicitly allowed sections, no export.

## API Rules

- Admin API calls must send `Authorization: Bearer <access_token>`.
- Server routes return generic auth errors: `Unauthorized`, `Forbidden`, or
  `Admin profile is not active`.
- Detailed Supabase or provider errors are logged server-side only.
- Sensitive actions write audit entries where a repository table exists.
- Authenticated browser clients have no direct `SELECT` grant on clients,
  appointments, certificates, specialist schedules, alerts, or reveal logs.
- A specialist is server-forced to the `specialist_id` linked to the profile;
  payload values cannot expand that scope.
- A specialist response contains no client rows, client ids, phone, email,
  contact preference, contact snapshots, or appointment notes. Contact values
  are omitted, not masked.
- Public booking exposes only each specialist's `public_slug`; the internal
  specialist UUID, which may match an auth user id, stays inside service-role RPCs.
- Contact reveal routes and RPCs allow only `owner` and `administrator`.
- Email delivery history, masked recipient addresses, and audited resend actions
  are owner/administrator-only. Specialists receive none of those fields.
- A specialist cannot create, edit, cancel, move, resize, or reassign an
  appointment. Only an owner or administrator assigns appointments.
- A specialist cannot create arbitrary personal blocks or edit calendar blocks.
  The only block mutation allowed by the API is a current, contact-free
  "Клиент сейчас" interval in the calendar linked to the authenticated profile;
  it immediately removes that interval from public availability.
- Owners and administrators see unresolved alerts on the dashboard. Resolution
  uses a server RPC and records the resolving actor without exposing raw alert
  metadata or client contact data.

## Payment Security

- PaymentIntent creation requires strict schema validation, origin/host checks,
  rate limiting, idempotency, and lightweight abuse protection.
- Stripe metadata should contain only minimal identifiers such as order id,
  certificate code, amount, locale, and version.
- Webhook fulfillment must validate metadata, check live/test environment,
  verify amount/currency, and use an atomic fulfillment lock.

## Transactional Email Security

- `RESEND_API_KEY`, verified `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`,
  `EMAIL_WORKER_SECRET`, and the preferences signing secret are server-only.
- Supabase Cron calls the protected worker with a Vault-managed bearer secret;
  concurrent workers claim rows with a lease and `SKIP LOCKED`.
  Vault entries are named `email_worker_url` (the full production
  `/api/internal/email/process` HTTPS URL) and `email_worker_secret` (the same
  value as `EMAIL_WORKER_SECRET`). After adding or rotating them, invoke the
  service-role `email_install_worker_cron()` RPC to install the five-minute job.
- The Resend webhook verifies the raw-body Svix signature and deduplicates by
  `svix-id`; open and click events are neither accepted nor stored.
- Bounce, complaint, and suppression events block later sends. Removing a
  suppression is restricted and audited.
- Care unsubscribe links use signed opaque notification identifiers. GET only
  explains the choice; a deliberate POST records withdrawal and cancels queued
  care email.
