# Admin Data Model

Supabase/PostgreSQL is the admin source of truth. Tables should support RLS,
server-side validation, and auditability.

## Core Tables

- `admin_profiles`: user id, email, display name, role, status, optional linked
  specialist id, timestamps.
- `admin_specialists`: business specialist identity, Auth link, public status,
  public daily limit, display order, calendar color, and a validated seven-day
  weekly schedule with an optimistic version for concurrent admin edits.
- `admin_specialist_services`: services eligible for each specialist.
- `admin_clients`: client profile, contact preferences, language, notes, tags,
  and explicit care-email consent/withdrawal timestamps and source.
- `admin_appointments`: date/time, client link, service, status, internal note.
- `admin_certificates`: code, amount, buyer/recipient, payment id, status.
- `admin_services`, `admin_prices`, `admin_media`, `admin_contact_channels`,
  `admin_contact_settings`, `admin_blog_posts`, `admin_site_settings`.
- `admin_finance_export_audit`: user, period, format, row count, totals.
- `admin_security_alerts`: suspicious contact-access events and resolution state.
- `gift_certificate_orders` and historical fulfillment locks for persisted,
  idempotent Stripe order processing.
- `email_notifications`: one outbox row per event and recipient, with a stable
  dedupe key, locale/template version, minimal payload, due/lease/retry state,
  and provider status.
- `email_webhook_events`: deduplicated Resend/Svix delivery events without
  open/click tracking.
- `email_suppressions`: bounced, complained, or provider-suppressed addresses
  that require an audited owner/administrator release after correction.

## Data Rules

- Keep card numbers, CVC, and financial secrets out of the database.
- Store internal notes separately from finance exports visible to accountants.
- Use enums or constrained values for statuses and roles.
- Reject unexpected payload keys at API boundaries.
- Enqueue email in the same database transaction as the booking, admin
  appointment mutation, or paid-certificate fulfillment. SQL performs no
  provider network calls.
- Store only order id, certificate code, amount, locale, and schema version in
  Stripe metadata; purchaser and recipient data remains in Supabase.
- Every appointment, calendar block, and public hold has a non-null specialist.
- Active appointment overlap and public capacity are calculated per specialist.
- Public availability, hold creation, and hold restoration enforce the selected
  specialist's working day and start/end times. New specialist schedules inherit
  the current booking settings; no fixed start hour is introduced by the schema.
- `admin_site_settings.public_booking_daily_limit` is canonical and is mirrored
  to active specialists; the allowed owner-configured range is 1 to 8.
- New services are assigned to all active publicly bookable specialists under
  the current all-services eligibility model.
- Existing pre-migration records are assigned to the default Natali specialist.
