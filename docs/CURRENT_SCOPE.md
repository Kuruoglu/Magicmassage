# Current Scope

This file is the short source of truth for future sessions. If it conflicts with
older plans or specs, follow this file and update the older document.

## First Release

Magic Massage Natali is currently a simplified public website:

- Next.js App Router with TypeScript.
- Static content maintained in code.
- Public locales: `bg`, `ru`, `ua`, and `en`.
- `UA` is the visible label; `ua` is the URL segment; metadata uses `uk-UA`.
- Home, Services, individual service pages, Gift Certificates, About, Contacts,
  privacy/cookie/legal information.
- Booking CTAs open Studio24 by client request.
- Gift certificates use an embedded Stripe Payment Element in test/demo mode
  until final prices and live-payment flags are approved.
- Real salon/treatment photography is used from project assets.
- Google Maps may be used only with cookie consent or another privacy-safe
  pattern.

## Approved Admin Direction

The client has re-approved a custom admin/CRM platform as the next product
direction after the current public-site MVP line. For admin, Supabase, roles,
clients, calendar, blog, settings, and Stripe finance exports, use
[ADMIN_SCOPE.md](./ADMIN_SCOPE.md) as the source of truth.

The old MVP exclusions below describe the current public-site release only. They
do not apply to tasks that explicitly start from the approved admin scope.

The approved admin direction includes:

- Supabase/PostgreSQL, Supabase Auth, Row Level Security, and Storage.
- A protected `/admin` area.
- Clients, users, roles, certificates, calendar, services, price list, media,
  contacts, blog, settings, and finance modules.
- A `Бухгалтер` role with narrow read/export access to Stripe sales reports for
  tax periods.
- A target migration from Studio24 handoff to internal request-based booking.

## Explicitly Out Of Scope For The Current Public-Site First Release

- Supabase/PostgreSQL.
- Custom admin panel.
- Internal booking flow.
- Specialist availability and booking database constraints.
- Booking emails, reminders, and Telegram automation.
- Blog.
- Localized service URL slugs.
- Admin publication workflow or publication gates.

## Approved Decisions

- English is an approved public locale.
- Shared English service slugs are acceptable for the first release.
- Studio24 is the booking provider for the first release.
- Gift certificates and online card payments are approved for the current
  implementation slice, but live payment is blocked until final prices are
  confirmed.
- Natali's experience and certificate claims are confirmed by the client.
- CTA color contrast should not be changed unless specifically requested again.

## Still Important

- Keep mobile drawer focus behavior covered by tests.
- Keep cookie consent active for Google Maps and other non-essential third-party content.
- Keep Stripe Elements text accurate: Stripe handles card data and Magic Massage
  Natali does not store card number, CVC, or financial data.
- Keep sitemap `lastModified` tied to real content dates or omit it.
- Keep the Playwright smoke suite covering public critical flows.
- Keep dependencies safe with targeted updates; avoid blind `npm audit fix --force`.
