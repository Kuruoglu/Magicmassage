# Magic Massage Natali - Project Instructions

## Purpose

Build a multilingual website and booking system for the Magic Massage Natali
massage studio in Burgas, Bulgaria. The public site must combine a conversion-
focused landing page with conventional content pages, strong local SEO, online
booking, a blog, and a custom administration panel.

Treat this file as the product and engineering baseline. Do not replace the
agreed architecture or expand the first release without explaining the tradeoff
and receiving approval.

## Project Roadmap

Read and maintain [PLANS.md](./PLANS.md) together with this file. `AGENTS.md`
defines the enduring product and engineering rules; `PLANS.md` defines the live
delivery sequence, MVP checklist, phase exit criteria, and later-release scope.
Update `PLANS.md` whenever approved work changes project scope or completion
status.

## Product Priorities

1. Make it easy to understand the services and request an appointment.
2. Build trust through real salon photography, clear information, and reviews.
3. Rank well for relevant local searches in Burgas.
4. Let the owner manage the main content without developer assistance.
5. Keep the first release simple while preserving clear upgrade paths for staff,
   automatic booking confirmation, and online payments.

## Agreed Technology

- Next.js App Router with TypeScript.
- PostgreSQL through Supabase.
- Supabase Auth for the administration panel.
- Supabase Storage for managed images.
- A custom administration panel in the same application.
- Telegram Bot API for owner notifications and customer contact links.
- Transactional email for confirmations, changes, cancellations, and reminders.
- Vercel is the preferred deployment target unless project constraints change.

Before selecting libraries or relying on framework behavior, verify the current
official documentation. Prefer maintained packages and existing platform
features over unnecessary dependencies.

## Languages And Locales

The first release supports:

- Bulgarian (`bg`)
- Russian (`ru`)
- Ukrainian (`UA`)

Use locale-specific URLs such as `/bg`, `/ru`, and `/ua`. Do not implement
language selection as client-side text replacement on one shared URL.

Use `UA` as the user-facing locale label and `ua` as the public URL segment.
For standards-based language metadata, HTML `lang`, and `hreflang`, map this
locale to the valid language code `uk` or regional code `uk-UA`; `ua` is a
country code and is not a valid standalone language code for SEO metadata.

- Content translations are entered manually in the administration panel.
- Every translatable content model must support all three locales.
- Bulgarian is the primary local-market language and default SEO reference.
- Add canonical URLs and correct `hreflang` relationships.
- Do not publish a locale when its required public content is incomplete.

## Public Information Architecture

The public site contains:

- Home
- Services catalog
- Individual service pages
- About
- Blog index and article pages
- Online booking
- Contacts, map, social links, and working hours
- Privacy policy
- Cookie information where non-essential cookies are used
- Booking cancellation and rescheduling terms

The home page is a conversion landing page with this intended flow:

1. Hero with a primary booking action and secondary services action.
2. Short introduction to Natali and the studio.
3. Popular services.
4. Studio benefits and trust signals.
5. Explanation of how a session works.
6. Real interior gallery.
7. Reviews.
8. Booking call to action.
9. Frequently asked questions.
10. Map, contacts, and working hours.

## Initial Services

Seed content should allow these service types, while all services remain fully
manageable through the administration panel:

- Classic massage
- Anti-cellulite massage
- Deep tissue massage
- Therapeutic massage
- Relaxing massage
- SPA procedures
- Thai massage
- Partial massage
- Cupping therapy
- Anti-stress massage
- Chiropractic massage

Do not copy the layout from the supplied legacy screenshot. It is a content
reference only.

Each service supports:

- localized name, summary, and full description;
- localized slug and SEO metadata;
- one or more durations and prices;
- cover image and gallery;
- benefits and preparation guidance;
- indications and contraindications where legally appropriate;
- localized FAQ entries;
- active, draft, and hidden states;
- display order and featured status;
- eligible specialists;
- booking confirmation mode.

Do not make unsupported health claims. The public use of terms equivalent to
"therapeutic" or "chiropractic" must be reviewed against Natali's qualifications
and applicable Bulgarian rules before publication.

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

Design mobile-first and meet WCAG 2.2 AA contrast, keyboard, focus, labeling, and
reduced-motion expectations.

## Booking Rules

The first release uses request-based booking:

1. Customer selects a service and duration.
2. Customer selects a specialist. Initially, only Natali exists.
3. Customer selects an available date and time.
4. Customer provides name, phone, and email.
5. Customer accepts the relevant privacy and booking terms.
6. The request enters `pending` status.
7. Natali confirms, rejects, or proposes a change.
8. The customer receives the result by email and, when available, Telegram.

The administration panel must allow confirmation behavior to be changed later:

- manual confirmation globally;
- automatic confirmation globally;
- per-service override.

Model specialists from the start even though Natali is initially the only one.
Each specialist needs services, availability, breaks, days off, vacation periods,
and booking buffers. Prevent overlapping bookings and race conditions at the
database level, not only in the interface.

Customers do not need accounts in the first release. Send a time-limited,
unguessable management link that allows cancellation or a rescheduling request.
Do not expose booking identifiers or personal data through predictable URLs.

Online payment is out of scope for the first release. Keep the booking and pricing
models compatible with adding deposits or full payment later without rewriting
the booking domain.

## Telegram And Email

First-release Telegram behavior:

- Notify Natali about new, changed, and cancelled booking requests.
- Include a secure link to the relevant administration view.
- Where safe and practical, provide confirm or reject actions.
- Provide customers with a visible link to start a conversation with the salon.
- Use Telegram for customer notifications only when the customer has provided or
  established a usable Telegram contact.

Email remains the required customer notification channel. Support booking
receipt, confirmation, rejection, rescheduling, cancellation, and reminder
templates in all three languages. Default to one reminder 24 hours before a
confirmed appointment, with timing configurable in administration.

Do not build a complete booking flow inside Telegram in the first release.

## Administration Panel

The owner must be able to manage the main site without editing code:

- booking calendar and booking list;
- confirmation, rejection, cancellation, and rescheduling;
- internal booking notes;
- services, variants, durations, prices, images, and display order;
- specialists and their service assignments and schedules;
- home, About, Contacts, FAQ, and legal-page content;
- blog posts, categories, covers, drafts, publication dates, and authorship;
- localized content for Bulgarian, Russian, and Ukrainian;
- media library with alt text and focal-point information;
- reviews and moderation status;
- SEO title, description, slug, social image, canonical behavior, and indexing;
- address, map coordinates, phone, email, Telegram, social links, and work hours;
- email and notification settings;
- global and per-service booking confirmation modes.

Start with one owner account. Keep authorization role-aware so restricted staff
accounts can be added later. All administrative routes and mutations require
server-side authorization.

## Content And Domain Modeling

Keep public content, translations, booking rules, and presentation concerns
separate. Prefer normalized domain entities with explicit relations over storing
critical booking data in generic page-builder JSON.

Expected core concepts include:

- locale-aware pages and reusable site settings;
- services and service variants;
- specialists and specialist-service assignments;
- recurring availability and date-specific exceptions;
- customers and bookings;
- booking status history and secure management tokens;
- blog posts and categories;
- reviews, media, FAQs, and notification templates.

Store booking timestamps consistently and render them in the salon's configured
timezone. Do not assume the developer machine's timezone.

## SEO And Discoverability

- Render indexable content on the server.
- Generate metadata, canonical links, `hreflang`, sitemap, and robots rules.
- Create stable localized slugs and permanent redirects when published slugs
  change.
- Add appropriate structured data for the local business, services, articles,
  breadcrumbs, and eligible FAQ content.
- Optimize for local Bulgarian and language-specific Burgas searches without
  keyword stuffing.
- Keep business name, address, and phone consistent with Google Business Profile.
- Support an appointment URL suitable for Google Business Profile.
- Optimize images and Core Web Vitals; avoid shipping the admin bundle publicly.
- Add Search Console and privacy-respecting analytics during launch preparation.

Never fabricate reviews, awards, certifications, staff qualifications, prices,
or medical benefits.

## Privacy And Security

Treat names, phone numbers, email addresses, Telegram identifiers, and booking
history as personal data.

- Collect only data needed to manage the appointment.
- Do not collect medical histories in the initial booking form.
- Record consent to required terms separately from optional marketing consent.
- Define retention and deletion behavior for customer and booking data.
- Restrict personal data to authorized administrative users.
- Validate all server inputs and enforce authorization server-side.
- Rate-limit public forms and booking endpoints.
- Add bot protection without blocking legitimate accessibility use.
- Keep secrets in environment variables and never commit them.
- Use signed or hashed management tokens with expiration and revocation.
- Maintain an auditable booking status history.
- Back up the database and document restoration before launch.

Do not add advertising, marketing trackers, or non-essential cookies without an
appropriate consent mechanism.

## Recommended Later Features

These are candidates after the first release, not default implementation scope:

- online deposits or full payments;
- gift certificates;
- multi-session packages;
- promotion codes;
- waiting list for occupied times;
- calendar export or synchronization;
- customer loyalty features;
- analytics for repeat clients and popular services;
- richer staff roles;
- AI-assisted translation drafts;
- full Telegram booking experience.

## Engineering Standards

- Use strict TypeScript and avoid `any` unless unavoidable and documented.
- Prefer Server Components by default; introduce Client Components only for real
  browser interaction.
- Keep domain logic outside React components and route handlers.
- Validate external input at every boundary with shared schemas.
- Use database transactions or equivalent atomic operations for booking changes.
- Keep modules focused and follow existing project patterns once they exist.
- Add an abstraction only when it removes meaningful duplication or complexity.
- Use accessible semantic HTML before custom ARIA behavior.
- Optimize images through the framework and require useful localized alt text.
- Never silently discard an incomplete translation or failed notification.
- Log operational failures without logging sensitive customer data.

## Testing Expectations

Use test-driven development for booking and authorization behavior. At minimum,
cover:

- locale routing, canonical URLs, and `hreflang` generation;
- service publication and translation completeness;
- available-slot calculation across work hours, breaks, buffers, exceptions, and
  existing bookings;
- concurrent attempts to reserve the same slot;
- manual and automatic confirmation modes;
- secure customer cancellation and rescheduling links;
- admin authentication and authorization;
- Telegram and email failure handling and retry behavior;
- metadata, sitemap, robots, and structured-data output;
- responsive booking flow and keyboard accessibility.

Run unit and integration tests for domain behavior, database-backed tests for
booking constraints, and end-to-end tests for the critical customer and admin
flows. Before declaring work complete, run formatting checks, linting, type
checking, tests, and the production build.

## Delivery Order

Unless the user requests a narrower task, plan work in these increments:

1. Brand tokens, information architecture, and responsive page prototypes.
2. Next.js foundation, database foundation, authentication, and localization.
3. Public pages, services, real-media handling, and contact information.
4. Content administration and multilingual publishing.
5. Specialist schedules, availability, and booking requests.
6. Booking administration, secure customer links, email, and Telegram.
7. Blog, technical SEO, structured data, and local-business integration.
8. Accessibility, security, performance, backup, analytics, and launch checks.

Every increment should leave the application in a working and testable state.
Do not begin broad implementation without a written plan for the requested slice.
