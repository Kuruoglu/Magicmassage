# Magic Massage Natali

Multilingual public website for Magic Massage Natali in Burgas. The current
first release is a public site with Studio24 booking handoff plus a test-mode
gift certificate purchase flow for Stripe Elements.

## Requirements

- Node.js 22+
- npm 10+

## Local Development

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The root route redirects to
Bulgarian. Localized home routes are:

- `http://localhost:3000/bg`
- `http://localhost:3000/ru`
- `http://localhost:3000/ua`
- `http://localhost:3000/en`

Gift certificate routes are available at `/${locale}/gift-certificates`.
Without Stripe environment variables the form stays in demo mode and cannot
accept real payments. Live payments require confirmed prices plus
`GIFT_CERTIFICATES_ENABLE_LIVE_PAYMENTS=true` and
`GIFT_CERTIFICATES_FINAL_PRICES_CONFIRMED=true`.

## Verification

```powershell
npm run lint
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

## Project Documents

- [AGENTS.md](./AGENTS.md) contains enduring product and engineering rules.
- [PLANS.md](./PLANS.md) is the living product roadmap.
- [Current scope](./docs/CURRENT_SCOPE.md) summarizes the active MVP decisions.
- [Agent notes](./docs/AGENT_NOTES.md) lists decisions that should not be
  re-reported as bugs.
- [Review checklist](./docs/REVIEW_CHECKLIST.md) defines verification before
  completion.
- [Foundation plan](./docs/superpowers/plans/2026-06-15-foundation-home.md) describes
  the first implementation slice.

Original approved photography remains in `assets/photos`. Optimized derivatives
used by the application live in `public/media`.
