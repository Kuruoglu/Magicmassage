# Darker Home Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply approved palette A and correct the four identified home-page layout issues without changing content or routing.

**Architecture:** Keep the existing `HomePageView` structure and global token system. Remove obsolete decorative JSX, then use focused CSS changes for palette, heading alignment, and mobile action positioning. Preserve all locale dictionaries and route behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, global CSS, Vitest, Testing Library, in-app browser.

---

### Task 1: Lock Removed Decorations With A Regression Test

**Files:**
- Modify: `src/components/home-page-view.test.tsx`
- Test: `src/components/home-page-view.test.tsx`

- [x] Add a test rendering the Russian home view and asserting that `Индивидуальный подход`, `01`, `02`, and `03` are absent.
- [x] Run `npm test -- --run src/components/home-page-view.test.tsx`.
- [x] Confirm the test fails because the current component still renders the hero note and service sequence labels.

### Task 2: Remove Obsolete Home Decorations

**Files:**
- Modify: `src/components/home-page-view.tsx`
- Test: `src/components/home-page-view.test.tsx`

- [x] Remove the complete `.hero-note` element from the hero.
- [x] Remove the service map index and the sequence `<span>` from each `.service-image`.
- [x] Run `npm test -- --run src/components/home-page-view.test.tsx` and confirm all focused tests pass.

### Task 3: Apply Palette A And Layout Corrections

**Files:**
- Modify: `src/app/globals.css`

- [x] Change the hero to a dark graphite/plum left-to-right gradient with light headline and description text.
- [x] Darken supporting surfaces using graphite, muted lavender-gray, and white cards while retaining purple accents.
- [x] Change `.section-heading` from bottom alignment to top alignment.
- [x] Remove obsolete `.hero-note` and service-number CSS.
- [x] Center the mobile `.button-row`; keep both hero actions centered in its vertical layout.
- [x] Run `npm run lint` and `npm run typecheck`.

### Task 4: Verify Responsive Rendering And Production Output

**Files:**
- Verify: `src/components/home-page-view.tsx`
- Verify: `src/app/globals.css`

- [x] Open `/ru` at a desktop viewport and verify the hero image remains visible, the overlay is dark, the hero note is absent, service numbers are absent, and services copy aligns to the heading top.
- [x] Open `/ru` at a mobile viewport and verify the primary booking button is centered and there is no horizontal overflow.
- [x] Check browser console warnings and errors.
- [x] Run `npm test -- --run`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- [x] Run `git diff --check` and commit the completed refinement.
