# GiftOfGab MVP Architecture

## Summary
GiftOfGab is now a server-rendered multi-route Node.js MVP for warm-path job search. The product still centers on one thesis: show the best opportunities where a user has a believable path into the company, then help them verify the path and act on it.

This implementation deliberately upgrades the prototype into an app-shaped MVP without pretending the hard integrations already exist.

## Product decisions preserved
- **Warm-path-first ranking** remains the core ranking model.
- **Opportunity feed** remains the primary surface after onboarding.
- **Route + evidence explanations** remain visible in both the feed and detail view.
- **LinkedIn is identity-only** in this MVP. It is presented as a sign-in/input source, not as a full graph dependency.

## Runtime architecture
- Plain Node.js HTTP server (`server.js`)
- No external dependencies
- Server-rendered HTML routes plus small JSON APIs
- In-memory session store using cookies
- In-memory sample data for jobs, companies, people, and relationship edges

## App structure
### Authentication / session
Implemented as a local mock auth flow:
- entry page with LinkedIn / Google / email choices
- session cookie (`gog_session`)
- in-memory session objects keyed by cookie value
- logout route that clears session state

This gives the app a believable login shell without adding external auth complexity yet.

### Onboarding
Implemented route:
- `GET /onboarding`
- `POST /onboarding`

Captures:
- target titles
- target locations
- strengths
- short professional story
- LinkedIn status
- contacts source status
- privacy posture

### Main product screens
- `GET /app` – warm opportunity feed
- `GET /opportunities/:id` – opportunity detail + outreach prep
- `GET /network` – network review / correction surface
- `GET /profile` – profile creation/edit flow
- `POST /profile` – save in-memory profile updates
- `GET /tracker` – saved + outreach tracker

## Data model in this repo
`data/sample-data.js` contains:
- `companies`
- `jobs`
- `people`
- `relationshipEdges`
- `demoUsers`
- `defaultOpportunityNotes`

## Matching and trust model
### Path discovery
For each company:
- check direct `candidate -> company contact` relationships
- check second-degree `candidate -> connector -> company contact` paths
- keep the strongest path as the route shown to the user

### Scoring
- `warmthScore` from edge strengths
- `fitScore` from simple overlap between profile targets/strengths and job metadata
- `overallScore = warmthScore * 0.65 + fitScore * 0.35`

### Trust/confidence layer
Separate from warmth labels:
- `Confirmed`
- `Likely`
- `Needs review`

This distinction matters because a route can exist without being equally safe to use.

## CTA strategy
The prototype's fake-feeling `Request intro` button was replaced with a more believable MVP flow:
- view path details
- review path quality
- prep outreach
- track status manually

This is closer to what an honest MVP should do before real connector workflow automation exists.

## API surface
- `GET /api/session`
- `GET /api/matches`
- `GET /api/graph`
- `POST /api/session/profile`

These APIs expose the same in-memory state used by the HTML views.

## Why this architecture is appropriate now
This repo still avoids overbuilding:
- no framework migration yet
- no database yet
- no real OAuth yet
- no background jobs yet
- no live imports yet

But it now has the minimum app structure needed to test:
- onboarding trust
- auth expectations
- profile setup
- decision-making on opportunities
- network review UX
- lightweight post-discovery workflow

## Deferred on purpose
Not yet implemented:
- persistent storage
- real OAuth / SSO
- live Google Contacts import
- live LinkedIn sign-in
- actual intro request delivery
- editable network persistence
- audit logs / rate limits / abuse controls

## Recommended next implementation order
1. Harden onboarding UX and source-connection states
2. Persist saved opportunities / tracker / profile data
3. Make network review actions actually mutate stored graph state
4. Add real auth and source imports
5. Add true intro-request workflow with message drafting and connector confirmation

## File map
- `server.js` – routes, session handling, render logic, matching logic
- `data/sample-data.js` – sample entities and seeded session/profile data
- `README.md` – product and route overview
- `SETUP.md` – local run and verification steps
- `ROADMAP.md` – staged evolution from app MVP to more complete stack

## Core product truth
The biggest truth still holds: **GiftOfGab should not depend on privileged LinkedIn graph APIs to be viable.**

This implementation respects that while still making the app feel like a real product instead of a static demo.
