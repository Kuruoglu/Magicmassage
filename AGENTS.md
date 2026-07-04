# Magic Massage Natali - Project Instructions

## Purpose

Build a fast multilingual public website for the Magic Massage Natali massage
studio in Burgas, Bulgaria. The first release is a focused marketing and local
SEO site with service pages, real photography, contact information, cookie
consent, and appointment calls to action that open Studio24.

The first release is intentionally not a custom booking platform. Supabase,
custom administration, internal booking, email automation, and Telegram booking
notifications are later-release candidates only.

Treat this file as the product and engineering baseline. When project scope
changes, update this file, [PLANS.md](./PLANS.md), and the short sync documents
under `docs/` before treating new behavior as a bug.

## Current Scope Documents

Read these files before planning, reviewing, or implementing:

- [PLANS.md](./PLANS.md) - live roadmap and MVP checklist.
- [docs/CURRENT_SCOPE.md](./docs/CURRENT_SCOPE.md) - short current truth for
  new sessions.
- [docs/AGENT_NOTES.md](./docs/AGENT_NOTES.md) - decisions that should not be
  re-reported as review findings.
- [docs/REVIEW_CHECKLIST.md](./docs/REVIEW_CHECKLIST.md) - verification checklist.

## Product Priorities

1. Make it easy to understand the services and request an appointment through
   Studio24.
2. Build trust through real salon photography, clear information, and confirmed
   experience or certification claims.
3. Rank well for relevant local searches in Burgas across supported languages.
4. Keep the first release simple, maintainable, and easy to verify.
5. Preserve upgrade paths for custom booking, administration, payments, email,
   Telegram automation, and richer content publishing.

## First-Release Technology

- Next.js App Router with TypeScript.
- Static content maintained in code.
- Real photography in `assets/photos` with optimized public derivatives in
  `public/media`.
- Studio24 as the external appointment booking destination.
- Google Maps may be used only with an appropriate cookie consent mechanism.
- Vercel is the preferred deployment target unless project constraints change.

Out of scope for the first release:

- Supabase/PostgreSQL.
- Supabase Auth.
- Custom administration panel.
- Internal booking database or availability engine.
- Automated booking email workflows.
- Telegram bot notifications or Telegram booking flow.
- Blog publishing.

Before selecting libraries or relying on framework behavior, verify the current
official documentation. Prefer maintained packages and existing platform
features over unnecessary dependencies.

## Languages And Locales

The first release supports:

- Bulgarian (`bg`)
- Russian (`ru`)
- Ukrainian (`UA`, public URL segment `ua`)
- English (`en`)

Use locale-specific URLs such as `/bg`, `/ru`, `/ua`, and `/en`. Do not implement
language selection as client-side text replacement on one shared URL.

Use `UA` as the user-facing locale label and `ua` as the public URL segment.
For standards-based language metadata, HTML `lang`, and `hreflang`, map this
locale to the valid language code `uk` or regional code `uk-UA`; `ua` is a
country code and is not a valid standalone language code for SEO metadata.

- Content translations are maintained manually in code for the first release.
- Every public content module should provide all four supported locales.
- Bulgarian is the primary local-market language and default SEO reference.
- Add canonical URLs and correct `hreflang` relationships.
- English is an approved public locale and must not be flagged as an accidental
  extra locale.

## Public Information Architecture

The first-release public site contains:

- Home.
- Services catalog.
- Individual service pages.
- About.
- Contacts, map access, social links, and working hours.
- Privacy policy.
- Cookie information and cookie consent where non-essential third-party content
  or cookies are used.
- Booking terms or clear Studio24 appointment handoff text where needed.

Not included in the first release:

- Blog index and article pages.
- Custom online booking pages.
- Customer cancellation or rescheduling pages.
- Administration routes.

The home page is a conversion landing page with this intended flow:

1. Hero with a primary Studio24 booking action and secondary services action.
2. Short introduction to Natali and the studio.
3. Popular services.
4. Studio benefits and trust signals.
5. Explanation of how a session works.
6. Real interior or treatment gallery.
7. Confirmed experience, certificate, or review content where available.
8. Booking call to action.
9. Frequently asked questions if final content exists.
10. Map, contacts, and working hours.

## Services

The first release uses a static services catalog maintained in code. Services
do not need admin-managed status fields, publication gates, or localized URL
slugs in this release.

Shared English service slugs are acceptable for all locales in the first release
because they keep URLs stable and implementation simple. Do not flag the absence
of localized service slugs as a release blocker unless the SEO strategy changes.

Current service content can include massage, partial massage, and SPA procedure
entries that are confirmed by the client. Keep claims factual and avoid
unsupported medical promises.

Each first-release service should support:

- localized name, summary, and service-page text;
- stable shared slug;
- localized SEO metadata where implemented;
- cover image and useful localized alt text;
- booking CTA that opens Studio24.

Later releases may add localized slugs, redirects, service status, variants,
durations, prices, galleries, FAQs, and admin editing.

Do not make unsupported health claims. Public use of terms equivalent to
"therapeutic", "chiropractic", or medical treatment should remain backed by
Natali's qualifications and applicable Bulgarian rules.

## Visual Direction

Use a light variation of the approved "Premium Wellness" direction.

- Approximately 70% warm ivory, off-white, or very pale lavender-gray.
- Approximately 20% charcoal or graphite for typography and selected sections.
- Approximately 10% saturated salon purple for primary actions and brand accents.
- A tiny muted warm-gold accent is acceptable but optional.
- Use refined editorial serif headings with a readable modern sans-serif body.
- Favor generous spacing, restrained geometry, soft shadows, and clear hierarchy.
- Use the yin-yang mark as a subtle brand element in the logo, dividers, or small
  decorative details. It must not dominate the page or make the brand feel occult.
- Draw restrained geometric-line inspiration from the physical salon interior.
- Use real salon and treatment photography in production. Generated images may
  be used for temporary concepts only and must not be presented as the real salon.

Avoid predominantly black pages, neon styling, excessive purple, beauty-salon
pink, bamboo and lotus cliches, mystical overload, clutter, and dated bordered
service-card grids.

Design mobile-first and meet WCAG 2.2 AA expectations for keyboard navigation,
focus behavior, labeling, and reduced motion. Current CTA colors are a deliberate
visual choice; do not treat contrast tuning as required unless requested again.

## Booking Rules

The first release uses Studio24 for appointment booking.

- Public booking CTAs open the Studio24 appointment URL.
- The website does not store booking requests, customer records, availability,
  cancellation links, rescheduling tokens, or booking status history.
- Studio24 owns service/date/time/customer-detail collection for appointments.
- The site should make the handoff clear enough that users understand they are
  booking through Studio24.

Internal request-based booking is a later-release candidate. If approved later,
model specialists, availability, breaks, days off, booking buffers, customer
management links, race-condition protection, email, and Telegram workflows from
the start of that later implementation.

## Telegram And Email

First-release behavior:

- Show public contact links where confirmed.
- Do not automate booking notifications from this website.
- Do not build a Telegram booking flow.
- Do not send booking receipt, confirmation, cancellation, or reminder emails
  from this website.

Automated email and Telegram notifications are later-release candidates tied to
custom booking.

## Administration Panel

A custom administration panel is out of scope for the first release. Content is
maintained in code and reviewed before deployment.

Later administration may include services, pages, media, reviews, SEO fields,
contacts, blog posts, booking settings, and role-aware authorization.

## Content And Claims

Keep public content, translations, SEO metadata, and presentation concerns
separate in code.

Natali's experience claims are confirmed by the client, including years of work,
client/session counts, and certificates. Certificates are expected to be added as
media later. Do not remove or flag these claims only because older roadmap notes
said qualifications were unconfirmed.

Do not fabricate reviews, awards, certifications, staff qualifications, prices,
or medical benefits. If a new claim appears, confirm it before treating it as
publishable.

## SEO And Discoverability

- Render indexable content on the server.
- Generate metadata, canonical links, `hreflang`, sitemap, and robots rules.
- Shared English service slugs are acceptable for the first release.
- Add appropriate structured data for local business and services.
- Optimize for local Bulgarian and language-specific Burgas searches without
  keyword stuffing.
- Keep business name, address, and phone consistent with Google Business Profile.
- Support the Studio24 appointment URL as the booking URL where appropriate.
- Optimize images and Core Web Vitals.
- Add Search Console during launch preparation.
- Use real content update dates for sitemap `lastModified`, or omit the field.
  Do not use `new Date()` for every sitemap entry.

Later releases may add localized slugs, slug history, and permanent redirects.

## Privacy, Cookies, And Security

The first-release website should avoid collecting personal booking data directly.
Studio24 handles appointment data after the external handoff.

- Keep secrets in environment variables and never commit them.
- Do not add advertising, marketing trackers, analytics, maps, or other
  non-essential third-party embeds without an appropriate consent mechanism.
- Google Maps iframe usage requires cookie consent before loading or an
  equivalent privacy-safe pattern.
- Privacy and cookie pages should clearly explain non-essential cookies and
  third-party content.
- Do not log sensitive customer data if future forms are added.

## Recommended Later Features

These are candidates after the first release, not default implementation scope:

- Supabase/PostgreSQL data model.
- Supabase Auth and custom administration.
- Internal request-based booking.
- Email confirmations, reminders, and failure handling.
- Telegram owner notifications and secure actions.
- Online deposits or full payments.
- Gift certificates.
- Multi-session packages.
- Promotion codes.
- Waiting list for occupied times.
- Calendar export or synchronization.
- Customer loyalty features.
- Analytics for repeat clients and popular services.
- Richer staff roles.
- Blog publishing.
- AI-assisted translation drafts.
- Full Telegram booking experience.

## Engineering Standards

- Use strict TypeScript and avoid `any` unless unavoidable and documented.
- Prefer Server Components by default; introduce Client Components only for real
  browser interaction.
- Keep reusable logic outside React components where it meaningfully reduces
  duplication or clarifies behavior.
- Validate external input at every boundary if forms or route handlers are added.
- Keep modules focused and follow existing project patterns once they exist.
- Add an abstraction only when it removes meaningful duplication or complexity.
- Use accessible semantic HTML before custom ARIA behavior.
- Optimize images through the framework and require useful localized alt text.
- Do not silently discard missing translations.

## Git Delivery

- After completing and verifying each requested change, create a focused commit
  and push the current feature branch to `origin` when the user asks for delivery
  or when the current workflow explicitly requires it.
- Do not push unfinished changes or changes with failing required checks.
- Keep commits scoped to the requested work and never include unrelated local
  modifications.
- Do not force-push unless the user explicitly requests it.

## Testing Expectations

For the first release, cover:

- locale routing for `bg`, `ru`, `ua`, and `en`;
- canonical URLs and `hreflang`;
- sitemap and robots output;
- public page rendering;
- service catalog and service detail pages;
- structured data where implemented;
- cookie consent behavior;
- Studio24 booking CTA targets;
- mobile menu keyboard/focus behavior;
- responsive public-page smoke flows.

Use Vitest for unit and component tests. Add Playwright for a small browser smoke
suite covering the public pages, mobile menu, language switcher, cookie consent,
and Studio24 booking CTA. Database-backed booking, admin authorization, and
booking concurrency tests are not required unless internal booking returns to
scope.

Before declaring work complete, run formatting/linting, type checking, relevant
tests, and the production build. For browser-visible UI, content, layout, image,
routing, or preview-link changes, verify the relevant page or flow in a real
browser on the actual preview URL when a preview URL is part of the task.

Before every final response after a code or content change, review the diff for
scope drift, outdated documentation, accessibility regressions, SEO regressions,
and missing verification.

## Delivery Order

Unless the user requests a narrower task, plan work in these increments:

1. Keep product documentation aligned with the simplified first-release scope.
2. Public pages, services, real-media handling, and contact information.
3. Cookie consent, privacy/cookie/legal content, and Google Maps behavior.
4. Technical SEO, structured data, sitemap dates, and local-business integration.
5. Accessibility fixes and Playwright smoke coverage.
6. Launch checks, production preview, Search Console, and final content review.

Every increment should leave the application in a working and testable state.
Do not begin broad implementation without a written plan for the requested slice.
