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
- `admin_clients`: client profile, contact preferences, language, notes, tags.
- `admin_appointments`: date/time, client link, service, status, internal note.
- `admin_certificates`: code, amount, buyer/recipient, payment id, status.
- `admin_services`, `admin_prices`, `admin_media`, `admin_contact_channels`,
  `admin_contact_settings`, `admin_blog_posts`, `admin_site_settings`.
- `admin_finance_export_audit`: user, period, format, row count, totals.
- `admin_security_alerts`: suspicious contact-access events and resolution state.
- `gift_certificate_orders` and fulfillment locks when payment hardening is
  implemented with persistent storage.

## Data Rules

- Keep card numbers, CVC, and financial secrets out of the database.
- Store internal notes separately from finance exports visible to accountants.
- Use enums or constrained values for statuses and roles.
- Reject unexpected payload keys at API boundaries.
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
