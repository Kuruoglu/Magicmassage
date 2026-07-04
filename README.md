# Magic Massage Natali

Multilingual public website for Magic Massage Natali in Burgas. The current
first release is a simplified public site with Studio24 booking handoff.

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
