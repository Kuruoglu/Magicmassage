# Current Scope

This file is the short source of truth for future sessions. If it conflicts with
older plans or specs, follow this file and update the older document.

## Current Release

Magic Massage Natali now combines the localized public site with the protected
admin/CRM platform:

- Next.js App Router with TypeScript and public locales `bg`, `ru`, `ua`, and
  `en`. `UA` is the visible label, while metadata uses `uk-UA`.
- Public services, contacts, blog, media, certificates, and feature flags are
  read from Supabase with the documented static fallbacks where applicable.
- Public instant booking is controlled by `public_booking_enabled`. When it is
  disabled, booking CTAs fall back to Studio24 and `/[locale]/booking` is hidden.
- A customer chooses a service, price/duration variant, a specific specialist or
  any available specialist, then an available date and time, enters contact
  details, and confirms the booking. A selected time is held for
  five minutes; one browser session may have only one active hold, and selecting
  another time atomically replaces it. Final confirmation creates a confirmed
  appointment immediately.
- The public booking session is a short-lived signed HttpOnly cookie. Reloading
  or switching locale restores the same active hold with a rotated bearer token;
  forged or expired cookies cannot restore or create holds.
- Public availability can be restricted to the specialist selected by the
  customer. The "any specialist" option is automatically distributed across
  active eligible specialists.
  Each specialist uses the owner-configured public cap from 1 to 8 appointments
  per day (8 by default).
  An authorized owner may create a ninth, tenth, or later manual appointment;
  the public cap never blocks an authorized admin write.
- Booking buffers are owner-configurable as 15 or 30 minutes and are snapshotted
  on each appointment. Public starts use a 30-minute grid with a 30-minute
  same-day lead time.
- Natali can add full-day or timed personal blocks in the admin calendar. Blocks,
  appointments, active holds, working hours, lead time, and the public daily cap
  all participate in public availability.
- Gift certificates use an embedded Stripe Payment Element and remain guarded by
  the existing feature and live-payment flags.
- Google Maps may load only after cookie consent or through another privacy-safe
  pattern.

## Admin Platform

Use [ADMIN_SCOPE.md](./ADMIN_SCOPE.md) for detailed admin behavior. The active
platform includes Supabase/PostgreSQL, Supabase Auth, protected `/admin` routes,
role checks, clients, appointments, calendar blocks, services, prices, media,
contacts, blog, settings, certificates, and finance exports.

Specialist access is intentionally narrow: each specialist has a read-only
appointment calendar, sees only assigned appointments and calendar blocks, and
has no standalone client or certificate module. A specialist never receives
client phone, email, contact preference, client id, contact snapshots, or notes.
Only an owner or administrator creates, changes, or reassigns appointments. A
specialist may use the contact-free "Клиент сейчас" action to occupy an interval
in their own calendar without creating a fake client record. Every admin role
requires TOTP multi-factor authentication.

Important booking invariants:

- Public slot hold and confirmation operations are atomic and idempotent.
- Public confirmations are created with `confirmed` status and an immutable
  public reference, price/duration snapshot, booking origin, and buffer snapshot.
- Admin calendar blocks are separate records, never fake clients or fake
  appointments.
- Owner booking-setting changes and calendar-block mutations are audited.
- Contact access endpoints and audited contact RPCs are owner/administrator-only;
  specialist requests are rejected before any contact data is returned.
- Manual admin appointments show capacity overflow such as `10 из 8`, but remain
  permitted.

## Explicitly Out Of Scope

- Customer accounts, self-service cancellation, and self-service rescheduling.
- Booking emails, reminders, and Telegram automation.
- Online deposits or massage payments outside the gift-certificate flow.
- Waiting lists, packages, loyalty, and promotion codes.
- Two-way Google Calendar synchronization.

## Approved Decisions

- English is an approved public locale.
- Shared English service slugs remain acceptable.
- Internal instant booking is the primary flow when enabled; Studio24 is the
  operational fallback when it is disabled.
- Gift certificates and online card payments are approved, but live payment
  remains blocked until final prices and production flags are confirmed.
- Natali's experience and certificate claims are confirmed by the client.
- CTA color contrast should not be changed unless specifically requested again.

## Still Important

- Keep public booking limits enforced in database transactions, not only in UI.
- Keep manual admin appointments independent from the public eight-per-day cap.
- Keep mobile drawer focus behavior and booking keyboard flow covered by tests.
- Keep the real-Supabase browser smoke covering hold creation and reload restore.
- Keep cookie consent active for Google Maps and non-essential third-party content.
- Keep Stripe Elements text accurate: Stripe handles card data and Magic Massage
  Natali does not store card number, CVC, or financial data.
- Keep sitemap `lastModified` tied to real content dates or omit it.
- Keep the Playwright smoke suite covering public critical flows.
- Keep dependencies safe with targeted updates; avoid blind `npm audit fix --force`.
