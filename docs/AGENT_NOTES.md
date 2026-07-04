# Agent Notes

Use this file to avoid noisy reviews caused by stale assumptions.

## Do Not Flag As Bugs

- `/en` is intentional and approved.
- Studio24 booking links are intentional and approved for the first release.
- Missing Supabase, custom admin, internal booking, booking emails, and Telegram
  automation are not bugs in the first release.
- Shared English service slugs are acceptable for the first release.
- Missing admin publication gates are acceptable because content is maintained in
  code and there is no first-release admin panel or blog.
- Confirmed experience and certificate claims may remain in public copy.
- CTA contrast should be left as designed unless the user asks to revisit it.

## Still Worth Flagging

- Broken locale routing, canonical URLs, or `hreflang`.
- Broken Studio24 booking CTA targets.
- Google Maps or analytics loading before cookie consent.
- Sitemap entries using `new Date()` as a fake update date.
- Hidden mobile menu content remaining keyboard-focusable.
- Missing alt text for meaningful images.
- Missing or stale privacy/cookie/legal content.
- Dependency vulnerabilities that have safe targeted updates.

## Review Framing

Separate findings into:

- `Current-scope defects`: bugs in the simplified public website.
- `Documentation drift`: code is intentionally different from an old plan.
- `Later-release scope`: useful future work, not a first-release blocker.

Do not treat later-release scope as a launch blocker unless the user explicitly
brings that feature back into the first release.
