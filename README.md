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

Typography currently uses CSS system fallbacks through `src/app/fonts.ts` so CI
and offline builds never fetch Google Fonts. To restore branded fonts later, add
licensed local font files deliberately and switch that module to `next/font/local`.

## Verification

```powershell
npm run lint
npm run typecheck
npm test -- --run
npm run test:e2e
npm run build
```

## Project Documents

Start with [AGENTS.md](./AGENTS.md), then use
[docs/CONTEXT_ROUTER.md](./docs/CONTEXT_ROUTER.md) to choose only the docs that
match the task. Keep scope in one canonical file and link to it instead of
duplicating large specifications across README, AGENTS, PLANS, and docs.

Original approved photography remains in `assets/photos`. Optimized derivatives
used by the application live in `public/media`.
