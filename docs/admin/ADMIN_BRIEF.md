# Admin Brief

The approved admin/CRM platform is the next product direction after the public
MVP line. It adds a protected `/admin` area connected to Supabase and Stripe
without removing the current public localized website.

## Goals

- Manage clients, appointments, gift certificates, services, prices, media,
  contacts, blog content, settings, users, roles, and finance exports.
- Keep the public MVP stable while admin functionality grows behind protected
  routes.
- Migrate from Studio24 handoff to internal booking only when that flow is
  explicitly implemented and verified.

## Boundaries

- Gift certificate payments are in scope.
- Online payment for massage sessions is not v1 admin scope.
- Google Calendar sync comes after the internal calendar is stable.
- Admin decisions live in `docs/admin/*`; old plans belong in `docs/archive/`.
