# Magic Massage Natali - Codex Context Router

Start here, then follow [docs/CONTEXT_ROUTER.md](./docs/CONTEXT_ROUTER.md)
for task-specific reading. Do not load archive folders, old superpowers plans,
media originals, build output, or environment files into default context.

## Always Read

- [docs/CONTEXT_ROUTER.md](./docs/CONTEXT_ROUTER.md)
- [docs/CURRENT_SCOPE.md](./docs/CURRENT_SCOPE.md)
- [docs/AGENT_NOTES.md](./docs/AGENT_NOTES.md)
- [docs/REVIEW_CHECKLIST.md](./docs/REVIEW_CHECKLIST.md)

## Scope Rules

- Preserve the public MVP: localized routes, services, contacts, Studio24
  booking handoff, gift certificates, cookie consent, and SEO foundations.
- Admin/CRM work is approved only from the admin docs routed in
  `docs/CONTEXT_ROUTER.md`; do not apply old first-release exclusions to admin
  tasks.
- Do not duplicate the same scope in README, AGENTS, PLANS, and docs. Keep one
  source of truth and link to it. Move outdated material to `docs/archive/`.

## Delivery Rules

- Work in small, reviewable steps.
- Do not commit secrets, force dependency fixes, downgrade Next major versions,
  add unlicensed font files, remove tests, or break public localized routes.
- Before saying code work is complete, run the relevant checks from
  [docs/REVIEW_CHECKLIST.md](./docs/REVIEW_CHECKLIST.md) and review the diff
  for scope drift, security regressions, SEO regressions, accessibility issues,
  and missing tests.
