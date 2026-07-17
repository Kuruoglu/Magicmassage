# Admin Modules

## Operations

- Dashboard: daily overview, pending requests, upcoming appointments, certificate
  alerts, quick actions.
- Clients: profile, contacts, language, visit history, certificates, notes,
  consent/GDPR actions.
- Calendar: day, week, month, list, statuses, create/reschedule/cancel/complete.
- Certificates: paid/manual certificates, PDF/email status, resend, redeem.

Owner and administrator calendars can filter by specialist and assign manual
appointments or personal blocks. They also manage each specialist's weekly
schedule, which controls public booking availability. A specialist receives only "My calendar",
cannot change assigned appointments, and cannot open the Clients or Certificates
modules. Client contacts and notes are never sent to the specialist. The
"Клиент сейчас" action creates a contact-free block in the specialist's own
calendar and removes that interval from public availability.
The owner/administrator dashboard shows unresolved bulk-contact security alerts
and lets an authorized user mark each alert as reviewed.

## Content

- Services and prices: localized content, SEO, visibility, ordering.
- Media: upload metadata, folders, alt text, publication readiness.
- Contacts: business details, channels, map, LocalBusiness data.
- Blog: draft/publish/schedule, localized article metadata.

## Finance

- Stripe sales for selected periods in `Europe/Sofia`.
- CSV/XLSX export through server routes only.
- Accountant sees finance exports without clients, settings, users, or internal
  operational notes.

## System

- Users and roles: invite, update profile, suspend/offboard, Auth ban, MFA, audit.
- Settings: business facts, booking rules, email templates, Stripe mode,
  privacy/cookie text, SEO defaults, audit retention.
