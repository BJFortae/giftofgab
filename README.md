# GiftOfGab MVP

GiftOfGab is now a small but coherent warm-path job search app, not just a single demo page. It keeps the core wedge intact: rank opportunities by credible human access first, then help the user understand the path, trust the evidence, and take a believable next step.

## What is implemented
- Mock auth + local session flow with LinkedIn / Google / email entry choices
- Multi-screen app structure with server-rendered routes
- Onboarding flow for preferences, privacy posture, and source selection
- Editable profile builder
- Warm-path opportunity feed as the main surface
- Opportunity detail page with route, evidence, confidence, and outreach prep
- Network review / correction screen
- Saved + outreach tracker screen
- Privacy/trust messaging throughout the product
- Confidence labels: Confirmed, Likely, Needs review
- Interim CTA flow that replaces fake "Request intro" behavior with review + outreach prep

## What is intentionally still mocked
- Auth is in-memory, not production OAuth
- LinkedIn is identity-only in the product copy and mock logic
- Contacts import is represented as status/config, not a live integration
- Data is in-memory and resets on restart
- Network review actions are UI scaffolding, not persisted mutations yet

## Run locally
```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Main routes
- `/` – sign-in / entry page
- `/onboarding` – onboarding and privacy/source setup
- `/app` – warm opportunity feed
- `/opportunities/:id` – opportunity detail and outreach prep
- `/network` – network review / correction
- `/profile` – profile creation/edit flow
- `/tracker` – saved + outreach tracker
- `/logout` – clear local session

## API routes
- `GET /api/session` – current session state, profile, matches, tracker items
- `GET /api/matches` – ranked opportunity feed JSON
- `GET /api/graph` – companies, people, and relationship edges
- `POST /api/session/profile` – update in-memory profile with JSON

## Product framing
GiftOfGab still follows the realistic MVP stance:
- warm-path-first ranking stays central
- the opportunity feed is the primary surface
- route + evidence explanation stays visible
- LinkedIn is treated as identity-only, not as a privileged graph dependency

The app now feels much closer to an actual product shell while keeping external integrations intentionally deferred.
