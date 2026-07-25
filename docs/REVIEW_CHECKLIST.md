# Review Checklist

Use this checklist before saying a public-site task is complete.

## Commands

Run the relevant checks for the touched area:

```powershell
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

When booking migrations or concurrency rules change and the Supabase admin
environment is configured, also run the self-cleaning remote smoke:

```powershell
npm run test:booking-db
```

When Playwright is available, run the public smoke suite too.

```powershell
npm run test:e2e
```

For transactional email changes, also verify the migration tests or real
Supabase smoke cover atomic enqueue/dedupe, concurrent claims and lease recovery,
Europe/Sofia reminder/care scheduling, suppression, webhook ordering, and gift
fulfillment idempotency.

## Public Smoke Coverage

Verify in a browser:

- `/bg`, `/ru`, `/ua`, and `/en` render.
- Services catalog renders in all supported locales.
- Gift Certificates renders in all supported locales and the form supports
  self/gift delivery, add/remove massage lines, free EUR amount, and disabled
  payment until valid.
- At least one service detail page renders.
- Language switcher preserves the current public page.
- Studio24 booking CTA opens the expected external URL.
- Public instant booking creates one real hold, keeps one countdown, restores the
  contact step after reload, and removes its remote fixture after the test.
- Public care-email consent is unchecked by default in all four locales; the
  signed preferences page does not mutate on GET and withdrawal succeeds only
  after the explicit POST action.
- Stripe Payment Element is embedded only on the gift certificate payment flow;
  card number, CVC, and financial data are not handled by site code.
- Mobile menu opens, closes, handles keyboard focus correctly, and does not leave
  hidden links tabbable.
- Cookie consent appears before non-essential third-party content loads.
- Google Maps loads only after consent, if an iframe is used.
- At 375 px and by keyboard, appointment/certificate drawers expose visible
  notification labels, helper/errors, textual statuses, focus-safe controls,
  and a disabled notification checkbox when no customer email exists.
- In admin day/week calendars, dragging an empty interval previews the snapped
  time range, then carries it into either a personal block or client appointment;
  click and immediate mobile touch-and-drag remain usable, with a 30-minute
  touch default, quick-swipe vertical scrolling, and horizontal week scrolling.

## Transactional Email Launch Checks

- Verified production HTTPS URL and Resend domain are configured with
  SPF/DKIM/DMARC.
- Resend API/sender/webhook secrets and worker/preferences secrets are present;
  Supabase Vault and five-minute Cron invoke the production worker.
- BG, RU, UA, and EN booking templates plus certificate PDF delivery have been
  test-sent before enabling flags.
- Enable in stages: certificates, owner alerts, booking operational messages,
  then care. Do not backfill historical appointments.

## SEO Checks

- Canonical URLs are correct.
- `hreflang` includes `bg-BG`, `ru`, `uk-UA`, `en`, and `x-default` where
  appropriate.
- Sitemap includes only current public routes.
- Sitemap `lastModified` uses real content dates or is omitted.
- Local business data uses confirmed name, address, phone, and Studio24 booking
  URL where appropriate.

## Content Checks

- Public claims are confirmed by the client.
- No unsupported medical promises are introduced.
- Meaningful images have useful localized alt text.
- Real salon/treatment photos are not described as generated or stock imagery.
- Privacy and cookie text matches the actual third-party content in use.
- Gift certificate price placeholders are marked as needing client confirmation
  before live payments.
- Gift certificate validity is confirmed as 6 months from the purchase date.

## Dependency Checks

- Run `npm audit --audit-level=moderate` before launch.
- Prefer targeted dependency updates.
- Do not run `npm audit fix --force` unless the resulting major or breaking
  changes are reviewed and explicitly approved.
