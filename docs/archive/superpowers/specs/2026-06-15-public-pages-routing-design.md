# Public Pages And Routing Design

## Goal

Convert the current single-page prototype into the first working slice of the
approved multi-page public website. Keep the localized home page as a conversion
landing page while adding dedicated Services, About, and Contacts routes for BG,
RU, and UA.

## Scope

This slice adds these public routes:

- `/[locale]` for the home landing page;
- `/[locale]/services` for the services catalog;
- `/[locale]/about` for Natali and the studio;
- `/[locale]/contacts` for address, hours, phone, a future-map area, and booking
  contact actions.

The locale segment remains `bg`, `ru`, or `ua`. Blog, booking, legal pages,
individual service routes, database content, and administration remain in the
project roadmap but are outside this implementation slice.

## Considered Approaches

### Recommended: Shared Shell With Dedicated Route Views

Create reusable site header, footer, and page-introduction components. Each route
owns a focused server-rendered page view and receives typed localized content.
The home page keeps concise preview sections that link to the full pages.

This approach matches the approved information architecture, avoids duplicating
navigation and footer markup, and leaves clear extension points for service
detail pages and database-backed content.

### Alternative: Keep One Large View And Switch Sections By Props

A single component could render different subsets based on the route. This would
require fewer files initially, but it would preserve the current oversized
component and couple unrelated pages together. It is rejected because future
services, blog, booking, and admin work would make the component harder to test
and maintain.

### Alternative: Build All Approved Public Routes At Once

Services, service details, About, Blog, Booking, Contacts, and legal pages could
be implemented in one broad increment. It is rejected for this step because the
blog, booking, legal content, and service data models are not ready. Shipping the
three currently supportable content pages produces a working multi-page site
without presenting empty routes as finished features.

## Routing And Navigation

The shared header uses locale-aware page links:

- brand and Home link: `/${locale}`;
- Services: `/${locale}/services`;
- About: `/${locale}/about`;
- Contacts: `/${locale}/contacts`.

The booking button continues to target the home booking call-to-action at
`/${locale}#booking` until a real booking page exists. It is a deliberate
temporary exception, not the site navigation model.

The locale switcher preserves the current page path. For example,
`/ru/services` switches to `/bg/services` or `/ua/services`, rather than sending
the visitor back to each locale home page.

## Page Responsibilities

### Home

The home page remains the visual landing page. Its Services, About, and Contacts
sections become previews with links to their corresponding routes. Existing hero,
trust, booking, photography, and approved visual styling remain intact.

### Services Catalog

The catalog presents all eleven initial service types from the product brief in
a responsive grid. Each item includes a localized name, short description, and
available real photography where appropriate. Cards do not link to nonexistent
detail pages in this slice; the structure must allow adding
`/[locale]/services/[slug]` later without redesigning the catalog.

Unsupported medical claims, prices, qualifications, durations, and treatment
promises must not be invented.

### About

The About page expands the existing Natali introduction, uses approved real
studio and treatment photography, and explains the personal session approach and
studio atmosphere. Content remains factual and avoids fabricated qualifications.

### Contacts

The Contacts page presents the currently approved address, phone, working-hours
text, and direct call action. It includes a map area designed for later Google
Maps integration, but must not add tracking or an unapproved embed in this slice.
Unknown email, Telegram, and social URLs must not be fabricated.

## Content Architecture

Split shared navigation and contact data from page-specific localized content.
Use typed dictionaries for BG, RU, and UA so every route has complete content at
build time. Reuse service data between the home preview and catalog instead of
maintaining separate names or descriptions.

Static dictionaries remain an interim source until the administration and
Supabase content model are implemented. Components must consume typed content so
the storage source can change later without rewriting presentation code.

## Component Boundaries

- `SiteHeader` owns brand, locale-aware navigation, locale switching, and the
  booking action.
- `SiteFooter` owns the shared contact summary and copyright area.
- `PublicPageShell` composes the shared header and footer around page content.
- `HomePageView` owns only home-specific sections.
- `ServicesPageView`, `AboutPageView`, and `ContactsPageView` own their route
  content.
- Small presentation components are extracted only when they remove real markup
  duplication across at least two views.

## SEO

Each route receives localized title, description, canonical URL, and language
alternates. The sitemap includes all four route types for each supported locale.
All public content remains server-rendered and indexable.

Standards metadata continues to map the public `ua` segment to `uk-UA`.

## Responsive And Accessibility Behavior

The existing responsive header behavior and full-width backgrounds are
preserved. New pages use the same content width, typography, focus styles, and
mobile spacing as the home page.

Navigation uses real links, the active page is exposed with `aria-current`, page
headings remain unique, images use meaningful localized alternative text, and
phone actions use `tel:` links. The implementation must not introduce horizontal
overflow or rely on hover for essential information.

## Testing And Verification

- Component tests verify locale-aware navigation and active-page behavior.
- Route/content tests verify complete BG, RU, and UA dictionaries.
- Metadata and sitemap tests verify every new localized URL.
- A real-browser pass checks desktop and mobile navigation, page loading, visual
  consistency, and absence of broken links.
- Required completion checks are tests, lint, type checking, and production
  build.

## Acceptance Criteria

- Header navigation no longer uses `#services`, `#about`, or `#contact`.
- Services, About, and Contacts render as dedicated pages in all three locales.
- Home previews link to the dedicated pages.
- Switching locale preserves the current public page.
- Shared header and footer are not duplicated across route views.
- Sitemap and localized metadata include the new routes.
- Existing approved home design remains visually intact.
