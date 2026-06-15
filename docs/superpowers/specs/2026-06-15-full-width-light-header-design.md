# Full-Width Light Header Design

## Goal

Correct the header background so it spans the complete viewport width and make
the header visibly lighter without changing its navigation or responsive
behavior.

## Approved Direction

- Use visual option A: a light graphite-lavender background around `#e9e3eb`.
- Use dark graphite text for the brand, navigation, and inactive locale links.
- Keep saturated purple for the active locale and booking button.
- Preserve the existing logo and header height.

## Structure

- The `<header>` becomes the full-width background element.
- Add one `.site-header-inner` container inside it.
- Move the existing brand, navigation, and actions into that inner container.
- The inner container keeps the existing maximum content width and horizontal
  padding, so it aligns with the rest of the page.

## Responsive Behavior

- On tablet, the main navigation remains hidden as it is now.
- On mobile, the booking button in the header remains hidden and the existing
  locale layout is preserved.
- The full-width background must reach both viewport edges at every breakpoint.
- The page must not gain horizontal overflow.

## Verification

- Add a component test confirming the header contains the inner layout wrapper.
- Verify in a real browser that the header background width equals the viewport
  width and its inner content remains aligned with the main content container.
- Run tests, lint, type checking, and the production build.

## Out Of Scope

- Sticky behavior, new navigation items, menu drawers, or header animations.
- Changes to the logo, hero, typography, or booking button shape.
