# Admin Data Model

Supabase/PostgreSQL is the admin source of truth. Tables should support RLS,
server-side validation, and auditability.

## Core Tables

- `admin_profiles`: user id, email, display name, role, status, timestamps.
- `admin_clients`: client profile, contact preferences, language, notes, tags.
- `admin_appointments`: date/time, client link, service, status, internal note.
- `admin_certificates`: code, amount, buyer/recipient, payment id, status.
- `admin_services`, `admin_prices`, `admin_media`, `admin_contact_channels`,
  `admin_contact_settings`, `admin_blog_posts`, `admin_site_settings`.
- `admin_finance_export_audit`: user, period, format, row count, totals.
- `gift_certificate_orders` and fulfillment locks when payment hardening is
  implemented with persistent storage.

## Data Rules

- Keep card numbers, CVC, and financial secrets out of the database.
- Store internal notes separately from finance exports visible to accountants.
- Use enums or constrained values for statuses and roles.
- Reject unexpected payload keys at API boundaries.
