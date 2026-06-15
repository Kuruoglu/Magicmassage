# Magic Massage Natali

Multilingual website and booking platform for Magic Massage Natali in Burgas.

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

## Verification

```powershell
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

## Project Documents

- [AGENTS.md](./AGENTS.md) contains enduring product and engineering rules.
- [PLANS.md](./PLANS.md) is the living product roadmap.
- [Foundation plan](./docs/superpowers/plans/2026-06-15-foundation-home.md) describes
  the first implementation slice.

Original approved photography remains in `assets/photos`. Optimized derivatives
used by the application live in `public/media`.
