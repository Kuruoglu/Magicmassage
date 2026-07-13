# Context Router

Use this file to keep Codex context small. Read only the files that match the
task.

## Always Read

- `AGENTS.md`
- `docs/CURRENT_SCOPE.md`
- `docs/AGENT_NOTES.md`
- `docs/REVIEW_CHECKLIST.md`
- `PLANS.md` only when roadmap status or sequencing matters.

## Admin Tasks

Read:

- `docs/admin/ADMIN_BRIEF.md`
- `docs/admin/ADMIN_SECURITY.md`
- `docs/admin/ADMIN_DATA_MODEL.md`
- `docs/admin/ADMIN_UX.md` when changing admin UI.
- `docs/admin/ADMIN_MODULES.md` when changing role/module behavior.

Do not use query parameters, hidden client state, or demo data as an authority
for admin roles. Server code must authorize against Supabase Auth and
`admin_profiles`.

## Gift Certificate And Payment Tasks

Read:

- `docs/CURRENT_SCOPE.md`
- `docs/admin/ADMIN_SECURITY.md` when payment data touches admin or finance.
- `src/content/gift-certificates.ts`
- `src/gift-certificates/*`
- `src/app/api/gift-certificates/*`
- `src/app/api/stripe/gift-certificates/route.ts`

Keep Stripe card data inside Stripe-controlled Elements. Keep PII out of Stripe
metadata except for minimal order identifiers and reconciliation fields.

## SEO And Content Tasks

Read:

- `docs/CURRENT_SCOPE.md`
- `docs/AGENT_NOTES.md`
- `src/content/*`
- `src/seo/*`
- `src/navigation/*`
- `src/app/sitemap.ts`
- `src/app/robots.ts`

Preserve `bg`, `ru`, `ua`, and `en` routes. Public `ua` maps to standards-based
`uk-UA` metadata.

## Preview And Deployment Tasks

Read:

- `docs/REMOTE_PREVIEW.md`
- `docs/REVIEW_CHECKLIST.md`
- `package.json`
- deployment or environment notes directly touched by the task.

Use production preview for client review and verify the actual URL before
reporting success.

## Do Not Read By Default

- `docs/archive/`
- `docs/superpowers/`
- `assets/photos/`
- heavy images under `public/media/`
- `.next/`, `out/`, `build/`, `coverage/`, `playwright-report/`,
  `test-results/`, `output/`, `node_modules/`
- `.env*` files other than `.env.example`

## Documentation Rule

Do not duplicate scope across README, AGENTS, PLANS, and docs. Link to the
canonical source, keep active docs short, and move outdated or historical
material into `docs/archive/`.
