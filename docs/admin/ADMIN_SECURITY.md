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
- Suspending a profile denies every application request immediately and also
  bans the Supabase Auth user; reactivation unbans Auth before activating the
  profile.

## Role Matrix

- `owner`: all sections, users, settings, finance, audit.
- `administrator`: operations, content, finance, non-critical settings.
- `accountant`: finance reports and exports only.
- `specialist`: calendar and operational appointment work only.
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
- Contact details are masked by default. An assigned specialist may explicitly
  reveal them from the appointment, with purpose, audit event, rolling limits,
  and a security alert after suspicious bulk access.
- A specialist cannot attach an arbitrary client id. The client must already
  have an appointment assigned to that specialist; an owner or administrator
  establishes the first assignment.
- Specialist reveal is limited to `confirmed`, `pending`, or `request`
  appointments between 48 hours in the past and 180 days in the future.
- Contact reveal counting is serialized per actor. The twentieth reveal in ten
  minutes creates an owner/admin warning; requests after sixty successful
  reveals in the same window are blocked.
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
