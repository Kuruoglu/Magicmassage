# Magic Massage Natali - Project Plan

## How To Use This File

This is the living roadmap for the current simplified first release. Read it
together with [AGENTS.md](./AGENTS.md), [docs/CURRENT_SCOPE.md](./docs/CURRENT_SCOPE.md),
[docs/AGENT_NOTES.md](./docs/AGENT_NOTES.md), and
[docs/REVIEW_CHECKLIST.md](./docs/REVIEW_CHECKLIST.md).

- Keep completed work checked off.
- Add newly approved work to the appropriate phase before implementing it.
- Do not move later-release ideas into the MVP without explicit approval.
- Update this file when scope, sequencing, or acceptance criteria change.

## Goal

Launch a fast, accessible, multilingual public website for Magic Massage Natali
in Burgas with service pages, local SEO, real photography, contact information,
cookie consent, and appointment calls to action that open Studio24.

## Current MVP Decisions

- The first release is a public website, not a custom booking platform.
- Booking CTAs open Studio24 by client request.
- There is no first-release Supabase database, custom admin panel, internal
  booking flow, email automation, or Telegram booking notification workflow.
- Public locales are `bg`, `ru`, `ua`, and `en`.
- `ua` remains the public URL segment and `UA` user-facing label; metadata maps
  it to `uk-UA`.
- Shared English service slugs are acceptable for the first release.
- Service content is maintained in code; there is no admin publication gate.
- No blog is included in the first release.
- Natali's experience and certificate claims are confirmed by the client.
- Google Maps iframe usage requires cookie consent before loading, or an
  equivalent privacy-safe pattern.
- Sitemap entries should use real content update dates or omit `lastModified`.
- A small Playwright smoke suite should cover public critical flows.

## MVP Definition

The first production release includes:

- Bulgarian, Russian, Ukrainian, and English public content.
- Public URL segments `/bg`, `/ru`, `/ua`, and `/en`.
- Home landing page, Services, individual service pages, About, Contacts, and
  required privacy/cookie/legal information.
- Studio24 appointment handoff for booking CTAs.
- A light Premium Wellness visual system using real salon photography stored
  under `assets/photos`.
- Technical and local SEO foundations.
- Cookie consent for non-essential third-party embeds or cookies.
- Public accessibility, responsive behavior, performance, and launch checks.

Out of MVP scope:

- Blog.
- Custom administration panel.
- Supabase/PostgreSQL.
- Internal booking, availability, specialists, booking status history, and
  customer management links.
- Booking emails, reminders, and Telegram notifications.
- Online payment, customer accounts, loyalty features, and full Telegram booking.

## Phase 1 - Scope, Content, And Design

- [x] Define product scope and first-release priorities.
- [x] Select Next.js and TypeScript for the public site.
- [x] Select the light Premium Wellness visual direction.
- [x] Define Bulgarian, Russian, Ukrainian, and English locale requirements.
- [x] Approve Studio24 as the first-release booking destination.
- [x] Approve shared English service slugs for the first release.
- [x] Confirm Natali's experience and certificate claims are allowed in copy.
- [x] Review the supplied photography and copy selected originals into assets.
- [ ] Confirm that all depicted clients have granted permission for website use.
- [ ] Confirm final business name spelling, address, telephone, email, Telegram,
  social profiles, working hours, map coordinates, and timezone.
- [ ] Approve final typography, color tokens, spacing, logo treatment, and image
  cropping rules.
- [ ] Prepare final BG, RU, UA, and EN content inventory.

**Exit criteria:** Current first-release scope is documented, business facts are
verified, required public content is ready, and no critical legal/content
decision is left unresolved.

## Phase 2 - Application Foundation

- [x] Initialize the Next.js App Router project with strict TypeScript.
- [x] Configure linting, type checking, and Vitest unit/component tests.
- [x] Implement locale routing for `/bg`, `/ru`, `/ua`, and `/en`.
- [x] Map the public `UA` locale to standards-compliant `uk-UA` metadata.
- [x] Create shared design tokens, layout primitives, navigation, and footer.
- [x] Add a minimal Playwright smoke-test setup.
- [ ] Add documented environment setup for production URL and preview behavior.
- [ ] Establish simple operational guidance for launch verification.

**Exit criteria:** The application builds, locale routes render, the quality
pipeline passes, and browser smoke checks cover the critical public flows.

## Phase 3 - Public Website

- [x] Build the responsive home landing page.
- [x] Build the localized services catalog.
- [x] Build individual service pages.
- [x] Build About and Contacts pages with working-hours sections.
- [x] Integrate selected real photographs from `assets/photos`.
- [x] Generate optimized web derivatives while preserving originals.
- [ ] Add or verify accessible image descriptions and robust responsive crops.
- [ ] Add privacy and cookie information pages or sections.
- [x] Add cookie consent for Google Maps and other non-essential third-party
  content.
- [ ] Ensure Studio24 booking CTAs are clear and tested.
- [ ] Validate responsive behavior, keyboard use, focus order, and reduced motion.

**Exit criteria:** All first-release public pages work on supported viewport
sizes and locales, use approved content/media, and pass critical accessibility
checks.

## Phase 4 - SEO And Local Discovery

- [x] Generate localized titles, descriptions, canonicals, and social metadata.
- [x] Generate correct `hreflang` links for BG, RU, UA, and EN content.
- [x] Generate sitemap and robots rules from public content.
- [x] Add localized metadata and sitemap entries for Services, About, and Contacts.
- [x] Replace `new Date()` sitemap timestamps with real update dates or omit
  `lastModified`.
- [ ] Add or verify LocalBusiness, Service, Breadcrumb, and eligible FAQ
  structured data.
- [ ] Verify consistent business name, address, and phone data.
- [ ] Provide the Studio24 appointment URL for Google Business Profile where
  appropriate.
- [ ] Connect Google Search Console.
- [ ] Add privacy-respecting analytics only with consent if requested.
- [ ] Validate Core Web Vitals and image loading behavior.

**Exit criteria:** Search engines receive complete localized metadata, valid
structured data, consistent local business information, and indexable performant
pages.

## Phase 5 - Accessibility, Privacy, And Launch Readiness

- [x] Fix mobile menu focus behavior so hidden drawer links are not tabbable and
  open drawer interaction is keyboard-safe.
- [ ] Verify focus visibility and keyboard navigation on all public pages.
- [ ] Verify reduced-motion behavior for decorative animations.
- [x] Verify cookie consent blocks Google Maps until allowed.
- [ ] Run an accessibility review of public workflows.
- [ ] Run dependency audit and apply safe targeted updates where possible.
- [ ] Verify production environment variables and domain configuration.
- [ ] Run linting, type checking, tests, Playwright smoke tests, and production
  build.
- [ ] Complete a production smoke test in BG, RU, UA, and EN.
- [ ] Confirm Natali accepts the public site and Studio24 booking handoff.

**Exit criteria:** All critical checks pass, no high-severity accessibility or
security findings remain, and the owner accepts the production public website.

## Later Releases

These features require separate approval and planning:

- Supabase/PostgreSQL data model.
- Supabase Auth and custom administration panel.
- Internal request-based booking.
- Specialist schedules, breaks, buffers, days off, and booking availability.
- Customer management links for cancellation and rescheduling.
- Transactional booking emails and reminders.
- Telegram owner notifications and secure booking actions.
- Online deposits or full payments.
- Gift certificates and multi-session packages.
- Promotion codes.
- Waiting list for occupied slots.
- Calendar synchronization and export.
- Customer accounts and booking history.
- Loyalty and repeat-customer features.
- Restricted staff administration accounts.
- Business analytics dashboards.
- Blog publishing.
- AI-assisted translation drafts.
- Complete booking inside Telegram.
- Localized service slugs and slug-change redirects.
- Admin publication status and translation completeness gates.

## Definition Of Done

A task is complete only when:

- the agreed behavior is implemented without unrelated scope expansion;
- documentation is updated when behavior or scope changes;
- tests cover the relevant public behavior for the current scope;
- accessibility and responsive behavior have been checked where applicable;
- cookie/privacy behavior is correct for third-party embeds;
- personal data is not exposed in logs, URLs, client bundles, or error messages;
- linting, type checking, relevant tests, and production build pass;
- browser-visible changes are verified in a real browser when required;
- no unapproved placeholders or unsupported claims remain in published content.
