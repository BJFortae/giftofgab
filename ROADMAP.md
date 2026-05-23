# Roadmap

## Current state - app-shaped MVP
Implemented now:
- mock auth + local session shell
- onboarding flow
- editable profile flow
- warm-path opportunity feed
- opportunity detail page
- network review page
- saved/outreach tracker
- privacy/trust messaging and confidence labels
- believable interim CTA flow for outreach prep

## Next up - persistence and real state
1. Persist users, profiles, saved jobs, and tracker state
2. Make network review actions actually confirm/remove/flag paths
3. Add source connection records and import history
4. Add lightweight event logging for onboarding + opportunity actions

## Then - real integrations
1. Replace mock auth with real OAuth / SSO
   - LinkedIn for identity
   - Google for contacts/calendar metadata
2. Add CSV/manual contact import flow
3. Add jobs ingestion pipeline instead of hardcoded jobs

## Then - real connector workflow
1. Draft intro requests in-app
2. Let users select connector + context
3. Track intro requested / sent / responded states
4. Add guardrails against spam and over-requesting

## Longer-term productization
- database-backed multi-user accounts
- privacy controls and deletion flow
- consent/audit trail for imports and connector actions
- notifications and reminders
- reputation/trust system
- admin/source health tooling

## Guiding opinion
The right near-term work is still product trust and workflow depth, not more ranking cleverness. The warm-path feed is already the wedge; now the app should get better at onboarding, confidence, and actionability.
