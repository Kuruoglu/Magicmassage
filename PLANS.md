# Magic Massage Natali - Project Plan

## How To Use This File

This is the living roadmap for the project. Read it together with
[AGENTS.md](./AGENTS.md) before planning or implementing work.

- Keep completed work checked off.
- Add newly approved work to the appropriate phase before implementing it.
- Do not move later-release ideas into the MVP without explicit approval.
- For a substantial feature, create a focused implementation plan before coding.
- Update this file when scope, sequencing, or acceptance criteria change.

## Goal

Launch a fast, accessible, multilingual website for Magic Massage Natali in
Burgas with service pages, local SEO, request-based online booking, a blog, a
custom administration panel, email notifications, and Telegram integration.

## MVP Definition

The first production release includes:

- Bulgarian, Russian, and Ukrainian public content.
- Public URL segments `/bg`, `/ru`, and `/ua`.
- Home landing page, Services, individual service pages, About, Blog, Booking,
  Contacts, and required legal pages.
- A light Premium Wellness visual system using the real salon photography stored
  under `assets/photos`.
- A custom authenticated administration panel.
- Manual content translation fields for all three languages.
- One specialist, Natali, with data structures prepared for additional staff.
- Request-based booking with manual confirmation by default.
- Configurable global and per-service automatic confirmation for future use.
- Customer email confirmations, changes, cancellations, and reminders.
- Telegram notifications for Natali and a customer contact link.
- Secure, expiring customer links for cancellation and rescheduling requests.
- Technical and local SEO foundations.
- Privacy, security, accessibility, performance, and backup checks.

Online payment, customer accounts, loyalty features, and complete booking inside
Telegram are not part of the MVP.

## Phase 1 - Discovery And Design

- [x] Define product scope and first-release priorities.
- [x] Select Next.js, TypeScript, Supabase/PostgreSQL, and a custom admin panel.
- [x] Select the light Premium Wellness visual direction.
- [x] Define Bulgarian, Russian, and Ukrainian locale requirements.
- [x] Review the supplied photography and copy selected originals into assets.
- [ ] Confirm that all depicted clients have granted permission for website use.
- [ ] Confirm Natali's exact qualifications and legally supportable service names.
- [ ] Confirm final business name spelling, address, telephone, email, Telegram,
  social profiles, working hours, map coordinates, and timezone.
- [ ] Produce responsive wireframes for the home, service, booking, article,
  contact, and administration screens.
- [ ] Approve final typography, color tokens, spacing, logo treatment, and image
  cropping rules.
- [ ] Prepare final BG, RU, and UA content inventory.

**Exit criteria:** Public and administrative screen structures are approved,
business facts are verified, and no critical content or legal naming decision is
left unresolved.

## Phase 2 - Application Foundation

- [ ] Initialize the Next.js App Router project with strict TypeScript.
- [ ] Configure linting, formatting, type checking, unit tests, and end-to-end
  testing.
- [ ] Add environment validation and documented local setup.
- [ ] Configure Supabase development and production environments.
- [ ] Define database migrations, generated types, and seed strategy.
- [ ] Add Supabase Auth and server-side owner authorization.
- [ ] Implement locale routing for `/bg`, `/ru`, and `/ua`.
- [ ] Map the public `UA` locale to standards-compliant `uk` or `uk-UA` metadata.
- [ ] Create shared design tokens, layout primitives, navigation, and footer.
- [ ] Establish error handling, structured operational logging, and audit rules
  without exposing personal data.

**Exit criteria:** The application builds and deploys, locale routes render,
authentication protects administration routes, migrations run cleanly, and the
quality pipeline passes.

## Phase 3 - Content Model And Administration

- [ ] Implement localized site settings and page content.
- [ ] Implement services, variants, durations, prices, media, FAQs, and status.
- [ ] Implement specialists and specialist-service assignments.
- [ ] Implement blog posts, categories, drafts, scheduled publication, and SEO
  fields.
- [ ] Implement reviews and moderation state.
- [ ] Implement the media library with localized alt text and focal points.
- [ ] Build administration navigation and dashboard.
- [ ] Build page, contact, service, specialist, blog, review, and media editors.
- [ ] Prevent publication when required translations are incomplete.
- [ ] Record administrative content changes where auditability is important.

**Exit criteria:** Natali can manage all agreed public content, translations,
services, prices, specialists, images, contacts, reviews, and blog posts without
editing code.

## Phase 4 - Public Website

- [ ] Build the responsive home landing page.
- [ ] Build the services catalog and localized service pages.
- [ ] Build About, Contacts, map, social, and working-hours sections.
- [ ] Build the blog index, category views, and article pages.
- [ ] Build privacy, cookie, cancellation, and rescheduling pages.
- [ ] Integrate selected real photographs from `assets/photos`.
- [ ] Generate responsive WebP or AVIF derivatives while preserving originals.
- [ ] Add accessible image descriptions and robust responsive crops.
- [ ] Add loading, empty, error, draft-preview, and not-found states.
- [ ] Validate responsive behavior, keyboard use, focus order, and reduced motion.

**Exit criteria:** All public pages work on supported viewport sizes and locales,
use real approved content, meet the agreed visual direction, and pass WCAG 2.2 AA
checks for critical flows.

## Phase 5 - Scheduling And Booking

- [ ] Implement recurring specialist availability.
- [ ] Implement breaks, booking buffers, days off, and vacation exceptions.
- [ ] Implement timezone-safe available-slot calculation.
- [ ] Implement customers, bookings, statuses, and booking status history.
- [ ] Enforce non-overlapping bookings at the database level.
- [ ] Build the customer booking flow for service, duration, specialist, slot,
  details, and required consent.
- [ ] Use manual confirmation as the initial default.
- [ ] Add configurable global and per-service confirmation modes.
- [ ] Build administration calendar and booking list views.
- [ ] Support confirm, reject, reschedule, cancel, and internal notes.
- [ ] Create hashed, expiring, revocable customer management tokens.
- [ ] Build customer cancellation and rescheduling-request pages.
- [ ] Add rate limiting, validation, and accessible bot protection.

**Exit criteria:** A customer can submit one valid request for an available slot,
Natali can manage it, concurrent booking attempts cannot double-book a slot, and
the customer can securely cancel or request rescheduling without an account.

## Phase 6 - Email And Telegram

- [ ] Select and configure a transactional email provider.
- [ ] Create localized receipt, confirmation, rejection, rescheduling,
  cancellation, and reminder templates.
- [ ] Send one configurable reminder 24 hours before confirmed appointments by
  default.
- [ ] Add retry and failure visibility without duplicating customer messages.
- [ ] Configure the Telegram bot and secure webhook handling.
- [ ] Notify Natali about new, changed, and cancelled bookings.
- [ ] Include secure links to the relevant administration booking view.
- [ ] Add confirm or reject Telegram actions only when authorization and replay
  protection are correctly enforced.
- [ ] Add a public link for customers to start a Telegram conversation.

**Exit criteria:** Every booking state transition produces the intended localized
notification, delivery failures are visible and retryable, and Telegram actions
cannot bypass administration authorization.

## Phase 7 - SEO And Local Discovery

- [ ] Generate localized titles, descriptions, canonicals, and social metadata.
- [ ] Generate correct `hreflang` links for BG, RU, and UA content.
- [ ] Generate sitemap and robots rules from published content.
- [ ] Add permanent redirects when published localized slugs change.
- [ ] Add LocalBusiness, Service, Article, Breadcrumb, and eligible FAQ structured
  data.
- [ ] Verify consistent business name, address, and phone data.
- [ ] Provide a stable booking URL for Google Business Profile.
- [ ] Connect Google Search Console.
- [ ] Add privacy-respecting analytics with consent where required.
- [ ] Validate Core Web Vitals and image loading behavior.

**Exit criteria:** Search engines receive complete localized metadata, valid
structured data, consistent local business information, and indexable performant
pages without duplicate-language URL problems.

## Phase 8 - Launch Readiness

- [ ] Complete unit, integration, database, and end-to-end test coverage for
  critical flows.
- [ ] Test concurrent booking attempts and notification failure recovery.
- [ ] Run an accessibility review of customer and administration workflows.
- [ ] Run a security review of authentication, authorization, tokens, rate limits,
  secrets, webhooks, and personal data access.
- [ ] Define retention and deletion rules for customer and booking data.
- [ ] Configure database and media backups.
- [ ] Perform and document a restoration test.
- [ ] Verify production environment variables and domain configuration.
- [ ] Run formatting, linting, type checking, tests, and production build.
- [ ] Complete a production smoke test in BG, RU, and UA.
- [ ] Confirm Natali can use the administration and booking workflows.

**Exit criteria:** All critical tests pass, backup restoration is proven, no
high-severity accessibility or security findings remain, and the owner accepts
the production workflows.

## Later Releases

These features require separate approval and planning:

- online deposit or full payment;
- gift certificates and multi-session packages;
- promotion codes;
- waiting list for occupied slots;
- calendar synchronization and export;
- customer accounts and booking history;
- loyalty and repeat-customer features;
- restricted staff administration accounts;
- business analytics dashboards;
- AI-assisted translation drafts;
- complete booking inside Telegram.

## Definition Of Done

A task is complete only when:

- the agreed behavior is implemented without unrelated scope expansion;
- tests cover the relevant success, validation, permission, and failure paths;
- accessibility and responsive behavior have been checked where applicable;
- personal data is not exposed in logs, URLs, client bundles, or error messages;
- documentation and this roadmap are updated when behavior or scope changes;
- formatting, linting, type checking, relevant tests, and production build pass;
- no placeholders or silently incomplete translations remain in published content.

