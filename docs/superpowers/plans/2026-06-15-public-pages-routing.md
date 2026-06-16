# Public Pages And Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the localized home-only prototype into a working multi-page public site with Services, About, and Contacts routes for BG, RU, and UA.

**Architecture:** Extract a shared public shell containing the header and footer, then render focused server-side page views inside it. Keep all published copy in typed locale dictionaries, reuse the service catalog for the home preview, and generate localized metadata and sitemap entries from a shared route definition.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, global CSS, Vitest, Testing Library.

---

### Task 1: Shared Public Route Model And Localized Content

**Files:**
- Create: `src/navigation/public-routes.ts`
- Create: `src/navigation/public-routes.test.ts`
- Create: `src/content/public-pages.ts`
- Create: `src/content/public-pages.test.ts`
- Modify: `src/content/home.ts`
- Modify: `src/content/home.test.ts`

- [x] **Step 1: Write failing route and content tests**

Add tests that require `home`, `services`, `about`, and `contacts` paths for every locale, verify locale switching preserves the selected page, and require eleven localized services plus complete About and Contacts copy for BG, RU, and UA.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/navigation/public-routes.test.ts src/content/public-pages.test.ts src/content/home.test.ts`

Expected: FAIL because the route and public-page modules do not exist and home services are not backed by the complete catalog.

- [x] **Step 3: Implement route helpers and typed dictionaries**

Implement:

```ts
export type PublicPageKey = "home" | "services" | "about" | "contacts";

export function getPublicPagePath(locale: Locale, page: PublicPageKey): string;
export function getLocaleSwitchPath(locale: Locale, page: PublicPageKey): string;
export function getPublicPagesContent(locale: Locale): PublicPagesContent;
```

The content must contain all eleven approved service names, restrained factual summaries, localized page headings, image alt text, and existing verified contact details. Update home content to use the first three catalog services as featured previews.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- --run src/navigation/public-routes.test.ts src/content/public-pages.test.ts src/content/home.test.ts`

Expected: all focused tests PASS.

### Task 2: Shared Header, Footer, And Public Shell

**Files:**
- Create: `src/components/site-header.tsx`
- Create: `src/components/site-footer.tsx`
- Create: `src/components/public-page-shell.tsx`
- Create: `src/components/public-page-shell.test.tsx`
- Modify: `src/components/home-page-view.tsx`
- Modify: `src/components/home-page-view.test.tsx`

- [x] **Step 1: Write failing shell navigation tests**

Render the shell on the Services page and assert that Services, About, and Contacts use `/${locale}/...` links, Services has `aria-current="page"`, locale links preserve `/services`, and the booking action targets `/${locale}#booking`.

- [x] **Step 2: Run the shell tests and verify RED**

Run: `npm test -- --run src/components/public-page-shell.test.tsx src/components/home-page-view.test.tsx`

Expected: FAIL because the shared shell does not exist and the home header still uses hash links.

- [x] **Step 3: Implement the shared components**

Move the existing brand/header markup into `SiteHeader`, move the full-width footer markup into `SiteFooter`, and compose both through:

```tsx
<PublicPageShell locale={locale} currentPage="services" content={content}>
  {children}
</PublicPageShell>
```

Remove duplicated header/footer markup from `HomePageView`. Replace home service and About actions with `Link` elements pointing to dedicated pages.

- [x] **Step 4: Run the shell tests and verify GREEN**

Run: `npm test -- --run src/components/public-page-shell.test.tsx src/components/home-page-view.test.tsx`

Expected: all focused tests PASS.

### Task 3: Services, About, And Contacts Page Views

**Files:**
- Create: `src/components/services-page-view.tsx`
- Create: `src/components/about-page-view.tsx`
- Create: `src/components/contacts-page-view.tsx`
- Create: `src/components/public-pages.test.tsx`
- Modify: `src/app/globals.css`

- [x] **Step 1: Write failing view tests**

Require the Services view to render eleven service headings, the About view to render real Natali/studio images and its localized main heading, and the Contacts view to render address, phone, hours, and a `tel:` action.

- [x] **Step 2: Run the view tests and verify RED**

Run: `npm test -- --run src/components/public-pages.test.tsx`

Expected: FAIL because the page views do not exist.

- [x] **Step 3: Implement the page views and responsive styling**

Build a shared editorial page hero style, a responsive services catalog, an About story layout, and a Contacts layout with a non-tracking future-map panel. Reuse existing design tokens, real images, content width, focus styles, and full-width section backgrounds.

- [x] **Step 4: Run the view tests and verify GREEN**

Run: `npm test -- --run src/components/public-pages.test.tsx`

Expected: all focused tests PASS.

### Task 4: App Routes, Metadata, And Sitemap

**Files:**
- Create: `src/app/(localized)/[locale]/services/page.tsx`
- Create: `src/app/(localized)/[locale]/about/page.tsx`
- Create: `src/app/(localized)/[locale]/contacts/page.tsx`
- Create: `src/seo/public-page-metadata.ts`
- Create: `src/seo/public-page-metadata.test.ts`
- Modify: `src/app/(localized)/[locale]/page.tsx`
- Modify: `src/app/sitemap.ts`
- Create: `src/app/sitemap.test.ts`

- [x] **Step 1: Write failing metadata and sitemap tests**

Require canonical and alternate links for `/bg/services`, `/ru/about`, and `/ua/contacts`, and require the sitemap to contain all twelve localized public URLs.

- [x] **Step 2: Run SEO tests and verify RED**

Run: `npm test -- --run src/seo/public-page-metadata.test.ts src/app/sitemap.test.ts`

Expected: FAIL because route metadata does not exist and the sitemap only contains home routes.

- [x] **Step 3: Implement routes and SEO helpers**

Each App Router page validates the locale, generates static locale parameters, returns localized metadata, and renders its page view inside `PublicPageShell`. Update the home route to use the same shell and metadata helper. Generate sitemap entries from the public page route model.

- [x] **Step 4: Run SEO tests and verify GREEN**

Run: `npm test -- --run src/seo/public-page-metadata.test.ts src/app/sitemap.test.ts`

Expected: all focused tests PASS.

### Task 5: Roadmap, Full Verification, And Delivery

**Files:**
- Modify: `PLANS.md`
- Modify: `docs/superpowers/plans/2026-06-15-public-pages-routing.md`

- [x] **Step 1: Update project status**

Mark the Services catalog and About/Contacts page work complete in Phase 4, while leaving individual service pages, map integration, blog, and booking unchecked.

- [x] **Step 2: Run all automated checks**

Run in order:

```powershell
npm test -- --run
npm run lint
npm run typecheck
npm run build
```

Expected: every command exits with code 0.

- [x] **Step 3: Verify in a real browser**

Open `/bg`, `/ru/services`, `/ua/about`, and `/bg/contacts`. Verify navigation, locale switching, unique page headings, desktop/mobile layout, all eleven service cards, contact links, and absence of broken images or horizontal overflow.

- [x] **Step 4: Mark plan complete, commit, and push**

Check completed steps in this file, stage only the requested implementation files, commit with `feat: add localized public pages`, and push `codex/foundation-home` to `origin`.
