# Foundation And Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a locally runnable Next.js foundation with BG/RU/UA routing and a polished responsive home page using approved real photography.

**Architecture:** Use the Next.js App Router with a locale segment at `app/[locale]`. Keep locale validation and content dictionaries in framework-independent modules so they can be unit tested. Use Server Components for the page and small CSS-only responsive components for the initial static experience.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules/global CSS, Vitest, Testing Library, ESLint.

---

### Task 1: Scaffold And Quality Pipeline

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/globals.css`

- [x] Generate a minimal Next.js App Router TypeScript project without Tailwind.
- [x] Add Vitest and Testing Library dependencies and test scripts.
- [x] Copy approved source media into `public/media` without deleting originals.
- [x] Run lint, type checking, tests, and build to establish the baseline.

### Task 2: Locale Routing And Content

**Files:**
- Create: `src/i18n/config.ts`
- Create: `src/i18n/config.test.ts`
- Create: `src/content/home.ts`
- Create: `src/content/home.test.ts`
- Create: `app/[locale]/layout.tsx`
- Create: `app/[locale]/page.tsx`
- Create: `app/page.tsx`

- [x] Write failing tests for supported locale detection, UA-to-`uk-UA` metadata mapping, and fallback behavior.
- [x] Run the focused tests and verify they fail because the modules do not exist.
- [x] Implement locale helpers and typed dictionaries for BG, RU, and UA.
- [x] Run the focused tests and verify they pass.
- [x] Redirect `/` to `/bg` and return a localized not-found result for unsupported locale segments.

### Task 3: Responsive Home Page

**Files:**
- Create: `src/components/site-header.tsx`
- Create: `src/components/hero.tsx`
- Create: `src/components/services-preview.tsx`
- Create: `src/components/about-preview.tsx`
- Create: `src/components/booking-cta.tsx`
- Create: `src/components/site-footer.tsx`
- Modify: `app/[locale]/page.tsx`
- Modify: `app/globals.css`

- [x] Build an accessible header with locale navigation and booking action.
- [x] Build a light Premium Wellness hero using the approved wide massage image.
- [x] Build services, about, trust, booking, and contact preview sections using real images.
- [x] Apply responsive typography, spacing, color tokens, visible focus, and reduced-motion rules.
- [x] Ensure all visible content comes from the selected locale dictionary.

### Task 4: Metadata And Verification

**Files:**
- Modify: `app/[locale]/layout.tsx`
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`
- Modify: `PLANS.md`

- [x] Add localized metadata, alternates, canonical URLs, and Open Graph defaults.
- [x] Add initial robots and sitemap generation for the three home routes.
- [x] Mark the completed foundation checklist in the project roadmap.
- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run `npm test -- --run`.
- [x] Run `npm run build`.
- [x] Launch locally and verify `/bg`, `/ru`, and `/ua` in a real browser.
