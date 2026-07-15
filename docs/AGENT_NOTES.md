# Agent Notes

Use this file to avoid noisy reviews caused by stale assumptions.

## Do Not Flag As Bugs

- `/en` is intentional and approved.
- Internal instant booking is intentional when `public_booking_enabled` is true.
- Studio24 is an intentional fallback when public booking is disabled.
- The public daily cap is eight non-cancelled appointments; it intentionally does
  not restrict manual appointments created by Natali in the admin calendar.
- A selected public time is held temporarily and becomes a confirmed appointment
  only after the customer submits the final review step. One opaque HttpOnly
  browser session may have only one active hold at a time. The cookie is signed,
  expires after 30 minutes, and restores the active hold after reload or locale
  navigation without exposing the persisted token hash.
- Shared English service slugs are acceptable.
- Confirmed experience and certificate claims may remain in public copy.
- CTA contrast should be left as designed unless the user asks to revisit it.

## Admin Decisions

- Use [ADMIN_SCOPE.md](./ADMIN_SCOPE.md) for detailed admin requirements and
  [CURRENT_SCOPE.md](./CURRENT_SCOPE.md) for current booking invariants.
- Supabase Auth plus server-side role authorization protects admin writes.
- Personal calendar blocks are separate domain records and must not create fake
  clients or appointments.
- Public booking settings and block mutations require audit entries.
- The `Бухгалтер` role has narrow Stripe finance read/export access and cannot
  edit site content, clients, bookings, users, or settings.

## Still Worth Flagging

- Broken locale routing, canonical URLs, or `hreflang`.
- A public booking CTA that does not follow the feature flag, or a hidden booking
  page that remains linked from public navigation.
- Non-atomic slot confirmation, duplicate booking races, stale holds, overlap
  errors, or public capacity checks that can be bypassed.
- Any admin write incorrectly blocked by the public eight-per-day limit.
- Broken Studio24 fallback targets while public booking is disabled.
- Broken gift-certificate totals, Stripe PaymentIntent creation, webhook
  signature validation, PDF generation, or email fulfillment.
- Google Maps or analytics loading before cookie consent.
- Hidden mobile-menu content remaining keyboard-focusable.
- Missing alt text for meaningful images or stale privacy/legal content.
- Dependency vulnerabilities that have safe targeted updates.

## Review Framing

Separate findings into:

- `Current-scope defects`: regressions in the public site, booking, or admin/CRM.
- `Documentation drift`: code intentionally differs from an old plan.
- `Later-release scope`: useful future work, not a current blocker.

Do not treat later-release scope as a launch blocker unless the user explicitly
brings that feature into the current release.
