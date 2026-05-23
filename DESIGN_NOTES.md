# GiftOfGab v1 Design Notes

## Product read
GiftOfGab has a strong wedge: job seekers do not want more cold applications; they want the shortest credible path to a human inside the company.

The best v1 is not "professional network intelligence" in the abstract. It is:

> Find relevant roles where you have a real warm path, then help you act on that path confidently.

That framing keeps the product concrete, useful, and easier to trust.

## Recommended v1 user
Primary user:
- experienced knowledge workers actively job searching
- especially product, operations, GTM, and leadership candidates
- people who already believe intros outperform applications

Why this user first:
- they understand the value quickly
- relationship-driven hiring is already normal for them
- they are more likely to have useful contacts and higher-value opportunities

## Core v1 flow
1. Sign up with LinkedIn, Google, or email
2. Set job preferences
3. Import contacts / add warm contacts manually
4. See matched roles with warm-path explanations
5. Open a role and view the best intro path
6. Choose an action:
   - ask for intro
   - save for later
   - mark path inaccurate
7. Track outreach status manually

## UX priorities
### 1. Fast trust-building onboarding
Users will hesitate if the product feels creepy, abstract, or data-hungry.

Need:
- very clear explanation of what gets imported
- visible value within first session
- progressive permissions instead of asking for everything at once

### 2. Confidence over magic
Do not imply certainty about relationship strength if the system only inferred it.

Need:
- labels like Confirmed, Likely, Needs review
- path explanations such as "You have this person in contacts" or "Shared past company"
- easy correction controls

### 3. One obvious primary action
The product should not feel like a job board plus CRM plus social graph explorer.

Primary action should be something like:
- Request intro
- Prep outreach
- Ask this contact for an introduction

### 4. Relevance before volume
A smaller list of highly relevant roles with credible paths is better than a giant feed.

## Naming / positioning guidance
Current idea is strong if positioned around warm access, not networking for networking's sake.

### What to avoid
- sounding like a generic job board
- sounding like a social network
- sounding like "AI finds your dream job"

### Strong positioning territory
- warm intros for job search
- your network as a job search advantage
- find jobs where you already have a path in
- turn contacts into real opportunities

### Product naming thought
"GiftOfGab" is memorable, but it implies talking/persuasion more than trusted introductions. It may work as a brand, but the product promise should be much clearer in the headline/subhead.

Example positioning:
- Find jobs where you already know someone.
- Stop cold applying. Start with the warm path.
- Discover open roles hidden inside your network.

## Must-have screens
### 1. Landing page
Purpose:
- explain the product in 10 seconds
- reduce privacy anxiety
- get user into onboarding

Needs:
- simple value prop
- how it works in 3 steps
- privacy reassurance
- CTA to get started

### 2. Onboarding flow
Steps:
- sign in
- define target roles/preferences
- connect contacts source or skip
- add manual contacts if needed
- first results state

Needs:
- progress indicator
- permission rationale before every import
- skip paths

### 3. Jobs dashboard
Purpose:
- show best opportunities ranked by fit + warmth

Needs:
- compact cards/list
- company, role, location
- warm-path badge
- confidence label
- save/dismiss actions

### 4. Opportunity detail page
Purpose:
- help user understand whether this role is worth pursuing and how to pursue it

Needs:
- role summary
- why it matches
- best known connection path
- connector/contact details at appropriate privacy level
- recommended next action
- notes / outreach tracker

### 5. Network review / contacts page
Purpose:
- let users confirm, edit, and improve the graph

Needs:
- imported sources
- matched people/companies
- unresolved or low-confidence matches
- easy confirm/remove actions

### 6. Saved / outreach tracker
Purpose:
- keep momentum after discovery

Needs:
- statuses like Saved, Intro requested, Outreach drafted, Follow up
- lightweight manual updates

## Must-have components
- trust/confidence badges
- path explanation module
- permission explainer card
- ranked job card
- intro action panel
- empty states that teach next step
- review-and-correct controls for bad matches

## Key design risks
### 1. Privacy fear kills onboarding
If the first experience feels like surveillance, users will bounce.

Mitigation:
- ask for the minimum first
- explain exactly why each permission matters
- offer manual entry and skip paths

### 2. Weak data creates fake value
If users see bad matches or flimsy connection claims, trust drops fast.

Mitigation:
- start with high-confidence paths only
- clearly separate inferred vs confirmed
- let users correct the graph easily

### 3. Too much breadth muddies the wedge
If v1 tries to be jobs marketplace + recruiting platform + social graph + AI copilot, the core value gets diluted.

Mitigation:
- center the product on one job: help me find and act on warm-path opportunities

### 4. LinkedIn expectation mismatch
Users may assume LinkedIn sign-in means full LinkedIn graph intelligence.

Mitigation:
- do not overpromise
- explain that LinkedIn helps with identity while contacts and user input improve results

## Recommended v1 opinion
The strongest v1 is a focused "warm-path job finder" for experienced professionals.

Not a broad hiring network.
Not a job board replacement.
Not a full recruiting platform.

Just: show me the best roles where I have a credible human path in, and help me use it.

## Gaps / conflicts in the current v1
- The broad relationship-platform vision is bigger than the current acceptance criteria and should not shape v1 UX too early.
- LinkedIn SSO is feasible; LinkedIn network graph dependence is risky and likely misleading for onboarding if not handled carefully.
- The brief says 1st/2nd-degree only, but current realistic data sources may support "confirmed" and "likely warm path" better than strict degree labeling.
- Connector incentives matter in the long-term vision, but v1 can defer this if the initial product is candidate-side only.

## Bottom line
For v1, optimize for:
- clear value in one session
- privacy trust
- high-confidence warm paths
- one obvious action per opportunity
- user-correctable graph data
