# Current Scope

This file is the short source of truth for future sessions. If it conflicts with
older plans or specs, follow this file and update the older document.

## First Release

Magic Massage Natali is currently a simplified public website:

- Next.js App Router with TypeScript.
- Static content maintained in code.
- Public locales: `bg`, `ru`, `ua`, and `en`.
- `UA` is the visible label; `ua` is the URL segment; metadata uses `uk-UA`.
- Home, Services, individual service pages, About, Contacts, privacy/cookie/legal
  information.
- Booking CTAs open Studio24 by client request.
- Real salon/treatment photography is used from project assets.
- Google Maps may be used only with cookie consent or another privacy-safe
  pattern.

## Explicitly Out Of Scope For The First Release

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
- Natali's experience and certificate claims are confirmed by the client.
- CTA color contrast should not be changed unless specifically requested again.

## Still Important

- Keep mobile drawer focus behavior covered by tests.
- Keep cookie consent active for Google Maps and other non-essential third-party content.
- Keep sitemap `lastModified` tied to real content dates or omit it.
- Keep the Playwright smoke suite covering public critical flows.
- Keep dependencies safe with targeted updates; avoid blind `npm audit fix --force`.
