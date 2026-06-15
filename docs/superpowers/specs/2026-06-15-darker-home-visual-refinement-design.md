# Darker Home Visual Refinement

## Goal

Refine the existing home page to use the approved palette option A: graphite and
deep purple with a clearly visible treatment photograph. Correct the specific
layout details identified during visual review without changing page content,
routing, or functionality.

## Approved Visual Direction

- Use graphite and deep plum as the dominant dark colors.
- Keep saturated salon purple for buttons, active language state, and small
  accents.
- Retain white or pale neutral surfaces only where they improve readability.
- Do not make the page predominantly black.
- Preserve the treatment photograph as the hero background, but reduce the pale
  overlay so the photograph remains recognizable and separated from the page.
- Use a dark left-to-right graphite/plum overlay with light hero text, matching
  palette option A selected in the visual comparison.

## Required Component Changes

### Hero

- Remove the floating `Individual approach` note completely.
- Increase image contrast by replacing the white-lavender wash with a restrained
  dark graphite/plum gradient.
- Use light text over the darkened image.
- Keep the existing headline, description, and two actions.
- On mobile, center the primary booking button horizontally. The secondary text
  link may remain below it, also centered for a balanced action group.

### Services

- Remove the visible `01`, `02`, and `03` labels from service images.
- Keep the three service cards, photography, descriptions, and booking links.
- Align the introductory paragraph to the top of the large services heading,
  rather than its bottom edge.

### Supporting Palette

- Replace bright white section transitions with graphite, muted lavender-gray,
  and controlled white surfaces.
- Keep service cards readable and lighter than their surrounding section.
- Continue using purple as an accent rather than a full-page background.
- Maintain WCAG AA contrast for body text, links, and buttons.

## Responsive Behavior

- Desktop and tablet retain the existing content hierarchy.
- Mobile hero actions form a centered vertical group.
- Removing the hero note must not leave unused layout space.
- Removing card numbers must not change image dimensions or card alignment.
- No horizontal overflow is allowed at supported viewport widths.

## Verification

- Add a component test proving the hero note and service sequence labels are not
  rendered.
- Run unit tests, lint, TypeScript checks, and the production build.
- Visually verify desktop and mobile hero contrast, services heading alignment,
  centered mobile action, and absence of horizontal overflow.

## Out Of Scope

- Changes to translations or service copy.
- New sections, animations, booking functionality, or administration features.
- Replacing the selected photographs or changing the font pairing.
