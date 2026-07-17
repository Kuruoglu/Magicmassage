# Admin UX

The admin UI is a quiet operational CRM, not a marketing page.

## Layout

- Dense, scan-friendly workspace with sidebar, header, filters, tables/lists,
  calendars, and right-side detail drawers.
- Right drawers should be full-height and preserve the main workspace width
  when closed.
- Avoid nested cards, oversized heroes, decorative blobs, and one-off visual
  patterns.

## Workflows

- Normal `Create appointment` starts with an empty client field and uses search
  or autocomplete.
- Month cells summarize counts and availability.
- Owners and administrators edit the selected specialist's weekly working days
  and half-hour start/end times from the calendar. Day and week views distinguish
  working time, off-hours, and days off.
- Large selectors should be searchable.
- Mode-specific views should show only actions relevant to that mode and role.

## Accessibility

- Role-restricted actions must be enforced on the server, not only hidden in UI.
- Focus states, keyboard paths, labels, and status text are required for forms,
  dialogs, drawers, calendars, and tables.
