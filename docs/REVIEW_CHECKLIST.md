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

When Playwright is available, run the public smoke suite too.

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
- Stripe Payment Element is embedded only on the gift certificate payment flow;
  card number, CVC, and financial data are not handled by site code.
- Mobile menu opens, closes, handles keyboard focus correctly, and does not leave
  hidden links tabbable.
- Cookie consent appears before non-essential third-party content loads.
- Google Maps loads only after consent, if an iframe is used.

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
- Gift certificate price placeholders and 6-month validity are marked as needing
  client confirmation before live payments.

## Dependency Checks

- Run `npm audit --audit-level=moderate` before launch.
- Prefer targeted dependency updates.
- Do not run `npm audit fix --force` unless the resulting major or breaking
  changes are reviewed and explicitly approved.
