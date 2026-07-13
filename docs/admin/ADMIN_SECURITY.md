# Admin Security

Admin access is never derived from query parameters, client state, demo data, or
public Supabase keys.

## Authentication

- `/admin` requires a valid Supabase session.
- Missing session redirects to `/admin/login`.
- Inactive or missing admin profile returns 403.
- The effective role comes only from `admin_profiles`.
- Service-role Supabase clients are server-only.

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

## Payment Security

- PaymentIntent creation requires strict schema validation, origin/host checks,
  rate limiting, idempotency, and lightweight abuse protection.
- Stripe metadata should contain only minimal identifiers such as order id,
  certificate code, amount, locale, and version.
- Webhook fulfillment must validate metadata, check live/test environment,
  verify amount/currency, and use an atomic fulfillment lock.
