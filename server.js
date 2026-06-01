import http from 'http';
import { companies, jobs, people, relationshipEdges, demoUsers, defaultOpportunityNotes } from './data/sample-data.js';

const port = Number(process.env.PORT || 3000);

const sessions = new Map();
const companyMap = new Map(companies.map((company) => [company.id, company]));
const peopleMap = new Map(people.map((person) => [person.id, person]));
const jobsMap = new Map(jobs.map((job) => [job.id, job]));

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) return acc;
      const key = part.slice(0, index);
      const value = decodeURIComponent(part.slice(index + 1));
      acc[key] = value;
      return acc;
    }, {});
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function scoreToWarmthLabel(score) {
  if (score >= 0.88) return 'Very warm';
  if (score >= 0.72) return 'Warm';
  return 'Possible path';
}

function scoreToConfidence(score) {
  if (score >= 0.87) return { label: 'Confirmed', tone: 'good' };
  if (score >= 0.72) return { label: 'Likely', tone: 'caution' };
  return { label: 'Needs review', tone: 'muted' };
}

function findPathForCompany(companyId) {
  const directPeople = people.filter((person) => person.companyId === companyId);
  let best = null;

  for (const person of directPeople) {
    const directEdge = relationshipEdges.find((edge) => edge.to === person.id && edge.from === 'candidate');
    if (directEdge) {
      const score = directEdge.strength;
      const confidence = scoreToConfidence(score);
      const path = {
        score,
        warmthLabel: scoreToWarmthLabel(score),
        confidence,
        connector: person.name,
        contact: person.name,
        route: ['You', person.name, companyMap.get(companyId)?.name ?? companyId],
        evidence: [directEdge.evidence],
        nextStep: 'Draft a direct outreach note and ask whether they are open to a quick conversation.'
      };
      if (!best || path.score > best.score) best = path;
    }

    const secondDegree = relationshipEdges
      .filter((edge) => edge.from === 'candidate')
      .map((candidateEdge) => {
        const bridgeEdge = relationshipEdges.find((edge) => edge.from === candidateEdge.to && edge.to === person.id);
        if (!bridgeEdge) return null;
        const bridgePerson = peopleMap.get(candidateEdge.to);
        if (!bridgePerson) return null;
        const score = Number(((candidateEdge.strength + bridgeEdge.strength) / 2).toFixed(2));
        const confidence = scoreToConfidence(score);
        return {
          score,
          warmthLabel: scoreToWarmthLabel(score),
          confidence,
          connector: bridgePerson.name,
          contact: person.name,
          route: ['You', bridgePerson.name, person.name, companyMap.get(companyId)?.name ?? companyId],
          evidence: [candidateEdge.evidence, bridgeEdge.evidence],
          nextStep: `Prep an intro request for ${bridgePerson.name} with context they can forward.`
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (secondDegree[0] && (!best || secondDegree[0].score > best.score)) {
      best = secondDegree[0];
    }
  }

  return best;
}

function fitSummary(job, profile) {
  const matchingTitle = profile.targetTitles.find((title) => job.title.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(job.title.toLowerCase()));
  const skillOverlap = job.skills.filter((skill) => profile.strengths.some((strength) => strength.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(strength.toLowerCase())));
  if (matchingTitle) return `Aligned with your ${matchingTitle} search.`;
  if (skillOverlap.length) return `Relevant strengths: ${skillOverlap.join(', ')}.`;
  return 'Matches your target industries and leadership scope.';
}

function buildMatches(profile) {
  return jobs.map((job) => {
    const company = companyMap.get(job.companyId);
    const path = findPathForCompany(job.companyId);
    const fitScore = job.skills.some((skill) => profile.targetTitles.join(' ').toLowerCase().includes(skill.toLowerCase())) ? 0.76 : 0.69;
    const warmthScore = path?.score ?? 0.42;
    const overallScore = Number(((warmthScore * 0.65) + (fitScore * 0.35)).toFixed(2));
    return {
      ...job,
      company,
      path,
      fitScore,
      overallScore,
      fitSummary: fitSummary(job, profile)
    };
  }).sort((a, b) => b.overallScore - a.overallScore);
}

function getCurrentSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.gog_session;
  if (!sid || !sessions.has(sid)) return null;
  return sessions.get(sid);
}

function baseProfile(overrides = {}) {
  return {
    fullName: 'Alex Morgan',
    email: 'alex@example.com',
    headline: 'Product and operations leader looking for warm-path executive roles',
    targetTitles: ['Chief Product Officer', 'VP Product', 'VP Operations'],
    targetLocations: ['Remote', 'New York, NY', 'San Francisco, CA'],
    strengths: ['Product strategy', 'Executive leadership', 'Operational scaling', 'AI products'],
    story: 'I help growth-stage companies scale product strategy and cross-functional execution.',
    privacyMode: 'Private by default',
    linkedInStatus: 'Connected for identity only',
    contactsStatus: 'Not connected yet',
    ...overrides
  };
}

function parseCommaSeparatedList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [...fallback];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function getOptionalText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function applyProfileForm(profile, form, options = {}) {
  const { includeIdentity = false } = options;

  if (includeIdentity) {
    profile.fullName = getOptionalText(form.fullName, profile.fullName);
    profile.email = getOptionalText(form.email, profile.email);
    profile.headline = getOptionalText(form.headline, profile.headline);
  }

  profile.targetTitles = parseCommaSeparatedList(form.targetTitles, profile.targetTitles);
  profile.targetLocations = parseCommaSeparatedList(form.targetLocations, profile.targetLocations);
  profile.strengths = parseCommaSeparatedList(form.strengths, profile.strengths);
  profile.story = getOptionalText(form.story, profile.story);
  profile.linkedInStatus = getOptionalText(form.linkedInStatus, profile.linkedInStatus);
  profile.contactsStatus = getOptionalText(form.contactsStatus, profile.contactsStatus);
  profile.privacyMode = getOptionalText(form.privacyMode, profile.privacyMode);

  return profile;
}

function createSession(user) {
  const sid = `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const profile = baseProfile(user?.profile || {});
  const session = {
    id: sid,
    user: user ? { id: user.id, name: user.name, email: user.email } : { id: 'demo-user', name: profile.fullName, email: profile.email },
    profile,
    onboardingComplete: Boolean(user?.onboardingComplete),
    savedOpportunities: [...(user?.savedOpportunities || ['job-1'])],
    outreach: [...(user?.outreach || defaultOpportunityNotes)],
    networkOverrides: relationshipEdges.map((edge) => ({ id: `${edge.from}-${edge.to}`, status: scoreToConfidence(edge.strength).label, note: edge.evidence }))
  };
  sessions.set(sid, session);
  return session;
}

function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data, null, 2));
}

function sendHtml(res, html, headers = {}) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function layout({ title, body, session, activePath = '/', notice = '' }) {
  const nav = session ? `
    <nav class="nav">
      <a href="/app" class="${activePath === '/app' ? 'active' : ''}">Opportunities</a>
      <a href="/opportunities/${jobs[0].id}" class="${activePath.startsWith('/opportunities') ? 'active' : ''}">Best path</a>
      <a href="/network" class="${activePath === '/network' ? 'active' : ''}">Network</a>
      <a href="/profile" class="${activePath === '/profile' ? 'active' : ''}">Profile</a>
      <a href="/tracker" class="${activePath === '/tracker' ? 'active' : ''}">Tracker</a>
      <a href="/logout">Log out</a>
    </nav>` : '';

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          --bg: #f6f4ef;
          --surface: #fffdf8;
          --surface-2: #f0f7f4;
          --ink: #17201d;
          --muted: #66706c;
          --line: #ded8cc;
          --line-strong: #c9c1b3;
          --accent: #245f73;
          --accent-strong: #143d4d;
          --accent-soft: #dff0f4;
          --coral: #bd5d43;
          --coral-soft: #fae7df;
          --good: #1d6b49;
          --good-soft: #e0f1e7;
          --warn: #8b640f;
          --warn-soft: #fff0c9;
          --muted-soft: #ece8df;
          --shadow: 0 16px 40px rgba(36, 44, 40, 0.08);
        }
        * { box-sizing: border-box; }
        html { background: var(--bg); }
        body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            linear-gradient(180deg, #fbfaf6 0, var(--bg) 340px);
          color: var(--ink);
          text-rendering: optimizeLegibility;
        }
        body::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(rgba(23,32,29,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,32,29,0.035) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.75), transparent 55%);
        }
        a { color: var(--accent); text-decoration: none; }
        a:hover { color: var(--accent-strong); }
        .shell { width: min(1240px, calc(100% - 40px)); margin: 0 auto; padding: 22px 0 64px; position: relative; }
        .topbar {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 22px;
          padding: 10px;
          border: 1px solid rgba(222, 216, 204, 0.78);
          border-radius: 8px;
          background: rgba(255, 253, 248, 0.86);
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 28px rgba(36, 44, 40, 0.06);
        }
        .brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: max-content;
          padding: 4px 8px;
          font-size: 18px;
          font-weight: 850;
          color: var(--ink);
        }
        .brand small { color: var(--muted); font-size: 12px; font-weight: 650; }
        .nav { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
        .nav a {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          border-radius: 6px;
          padding: 9px 12px;
          color: #48544f;
          font-size: 14px;
          font-weight: 700;
        }
        .nav a:hover { background: var(--muted-soft); color: var(--ink); }
        .nav a.active {
          color: var(--accent-strong);
          background: var(--accent-soft);
          box-shadow: inset 0 0 0 1px rgba(36, 95, 115, 0.14);
        }
        .card, .panel {
          background: rgba(255, 253, 248, 0.96);
          border: 1px solid rgba(222, 216, 204, 0.9);
          border-radius: 8px;
          padding: 24px;
          box-shadow: var(--shadow);
        }
        .panel.hero-copy {
          background: linear-gradient(135deg, #fffdf8 0%, #eef7f2 100%);
          border-color: #d7d1c4;
        }
        .hero { display: grid; gap: 18px; grid-template-columns: minmax(0, 1.32fr) minmax(310px, 0.68fr); align-items: start; }
        .grid { display: grid; gap: 18px; }
        .grid.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid.cols-3 { grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
        h1, h2, h3 { margin: 0 0 10px; line-height: 1.08; letter-spacing: 0; color: var(--ink); }
        h1 { max-width: 780px; font-size: 44px; }
        h2 { font-size: 24px; }
        h3 { font-size: 19px; }
        p { margin: 0 0 14px; line-height: 1.6; color: var(--muted); }
        ul { margin-top: 10px; margin-bottom: 0; padding-left: 20px; color: var(--muted); }
        li + li { margin-top: 6px; }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 12px;
          color: var(--coral);
          font-weight: 850;
        }
        .eyebrow::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--coral);
        }
        .badge, .confidence {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 850;
          white-space: nowrap;
        }
        .badge { background: var(--accent-soft); color: var(--accent-strong); }
        .confidence.good { background: var(--good-soft); color: var(--good); }
        .confidence.caution { background: var(--warn-soft); color: var(--warn); }
        .confidence.muted { background: var(--muted-soft); color: #5a5f5b; }
        .muted { color: var(--muted); }
        .stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 22px; }
        .stat {
          min-height: 96px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid rgba(201, 193, 179, 0.8);
          border-radius: 8px;
          padding: 14px;
          background: rgba(255, 253, 248, 0.7);
          color: #54605b;
          font-size: 13px;
          font-weight: 700;
        }
        .stat strong { display: block; margin-bottom: 8px; font-size: 24px; line-height: 1.05; color: var(--ink); }
        .trust-box {
          border-left: 4px solid var(--accent);
          background: rgba(223, 240, 244, 0.55);
          border-radius: 6px;
          padding: 14px 16px;
        }
        .trust-box p:last-child { margin-bottom: 0; }
        .op-card { display: grid; gap: 16px; transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease; }
        .op-card:hover { transform: translateY(-2px); border-color: var(--line-strong); box-shadow: 0 18px 44px rgba(36, 44, 40, 0.11); }
        .pill-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .pill {
          border: 1px solid #d9d3c6;
          background: #f8f5ee;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 13px;
          font-weight: 700;
          color: #42504a;
        }
        .path-box {
          border-left: 4px solid var(--coral);
          background: #fff7f2;
          border-radius: 6px;
          padding: 14px 16px;
        }
        .path-box p:last-child { margin-bottom: 0; }
        .action-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
        .button, button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid transparent;
          border-radius: 7px;
          padding: 10px 14px;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
        }
        .button:hover, button:hover { transform: translateY(-1px); }
        .button.primary, button.primary {
          background: var(--ink);
          color: #fff;
          box-shadow: 0 10px 20px rgba(23, 32, 29, 0.16);
        }
        .button.primary:hover, button.primary:hover { color: #fff; background: #0c1411; }
        .button.secondary, button.secondary {
          background: #fffdf8;
          border-color: var(--line);
          color: #24322e;
        }
        .button.secondary:hover, button.secondary:hover { background: #f1eee5; color: var(--ink); }
        .button.link { background: transparent; color: var(--accent); padding-left: 0; }
        form { display: grid; gap: 14px; }
        .action-row form { display: inline-flex; gap: 0; }
        label { display: grid; gap: 7px; font-size: 14px; font-weight: 800; color: var(--ink); }
        input, textarea, select {
          width: 100%;
          padding: 12px 13px;
          border-radius: 7px;
          border: 1px solid var(--line);
          font: inherit;
          color: var(--ink);
          background: #fffdf8;
          box-shadow: inset 0 1px 0 rgba(23, 32, 29, 0.03);
        }
        input:focus, textarea:focus, select:focus, .button:focus-visible, button:focus-visible, .nav a:focus-visible {
          outline: 3px solid rgba(36, 95, 115, 0.22);
          outline-offset: 2px;
          border-color: var(--accent);
        }
        textarea { min-height: 116px; resize: vertical; }
        .split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .list { display: grid; gap: 10px; padding-left: 0; list-style: none; }
        .list li {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 16px;
          background: rgba(255, 253, 248, 0.78);
        }
        .notice { margin-bottom: 18px; padding: 12px 14px; border-radius: 8px; background: var(--accent-soft); color: var(--accent-strong); font-weight: 750; }
        .timeline { border-left: 2px solid #d0c8ba; margin-left: 8px; padding-left: 18px; display: grid; gap: 18px; }
        .small { font-size: 13px; color: var(--muted); }
        @media (max-width: 920px) {
          .shell { width: min(100% - 28px, 1240px); padding-top: 14px; }
          .hero, .split, .grid.cols-2 { grid-template-columns: 1fr; }
          .topbar { align-items: stretch; flex-direction: column; }
          .nav { justify-content: flex-start; }
          h1 { font-size: 34px; }
        }
        @media (max-width: 560px) {
          .card, .panel { padding: 18px; }
          .nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .nav a { justify-content: center; text-align: center; }
          .action-row { align-items: stretch; }
          .action-row form { width: 100%; }
          .button, button { width: 100%; }
          h1 { font-size: 30px; }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <header class="topbar">
          <div class="brand">GiftOfGab<small>Warm-path job search MVP</small></div>
          ${nav}
        </header>
        ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ''}
        ${body}
      </main>
    </body>
  </html>`;
}

function renderLoginPage() {
  const providerButtons = ['LinkedIn', 'Google', 'Email'].map((provider) => `<button class="button secondary" type="submit" name="provider" value="${provider.toLowerCase()}">${provider}</button>`).join('');
  return layout({
    title: 'GiftOfGab · Sign in',
    body: `
      <section class="hero">
        <div class="panel hero-copy">
          <div class="eyebrow">Stop cold applying</div>
          <h1>Find jobs where you already have a believable path in.</h1>
          <p>GiftOfGab ranks roles by warm-path quality first, then helps you verify the path, prep outreach, and track momentum. LinkedIn stays identity-only for this MVP; your real advantage comes from contacts, coworker history, and manual confirmation.</p>
          <div class="stat-row">
            <div class="stat"><strong>Warm-path-first</strong>Opportunity feed</div>
            <div class="stat"><strong>Confidence labels</strong>Confirmed, likely, needs review</div>
            <div class="stat"><strong>Private by default</strong>No employer-visible graph</div>
          </div>
        </div>
        <aside class="panel">
          <h2>Sign in to start onboarding</h2>
          <p class="small">This MVP uses mock auth and local in-memory sessions. Choose a provider to simulate the intended entry point.</p>
          <form method="POST" action="/auth/login">
            <label>Email
              <input type="email" name="email" value="alex@example.com" />
            </label>
            <label>Full name
              <input type="text" name="fullName" value="Alex Morgan" />
            </label>
            <div class="action-row">${providerButtons}</div>
          </form>
          <div class="trust-box" style="margin-top:16px;">
            <strong>Privacy and trust</strong>
            <p class="small">We never show your imported contacts publicly. You can skip imports, review inferred relationships, and decide whether a path is strong enough to use before any outreach.</p>
          </div>
        </aside>
      </section>`
  });
}

function renderOnboardingPage(session) {
  const profile = session.profile;
  return layout({
    title: 'GiftOfGab · Onboarding',
    session,
    activePath: '/onboarding',
    body: `
      <section class="panel">
        <div class="eyebrow">Onboarding · 3 steps</div>
        <h1>Set up your search and trust settings</h1>
        <p>We start with the minimum: who you are, what you want, and which network sources you feel comfortable using. You can edit any of this later.</p>
        <form method="POST" action="/onboarding">
          <div class="split">
            <label>Target titles
              <input name="targetTitles" value="${escapeHtml(profile.targetTitles.join(', '))}" />
            </label>
            <label>Target locations
              <input name="targetLocations" value="${escapeHtml(profile.targetLocations.join(', '))}" />
            </label>
          </div>
          <label>Strengths to match against
            <input name="strengths" value="${escapeHtml(profile.strengths.join(', '))}" />
          </label>
          <label>Your profile summary
            <textarea name="story">${escapeHtml(profile.story)}</textarea>
          </label>
          <div class="split">
            <label>LinkedIn
              <select name="linkedInStatus">
                <option ${profile.linkedInStatus === 'Connected for identity only' ? 'selected' : ''}>Connected for identity only</option>
                <option ${profile.linkedInStatus === 'Skipped for now' ? 'selected' : ''}>Skipped for now</option>
              </select>
            </label>
            <label>Contacts source
              <select name="contactsStatus">
                <option ${profile.contactsStatus === 'Google Contacts connected' ? 'selected' : ''}>Google Contacts connected</option>
                <option ${profile.contactsStatus === 'Manual upload only' ? 'selected' : ''}>Manual upload only</option>
                <option ${profile.contactsStatus === 'Not connected yet' ? 'selected' : ''}>Not connected yet</option>
              </select>
            </label>
          </div>
          <label>Privacy posture
            <select name="privacyMode">
              <option ${profile.privacyMode === 'Private by default' ? 'selected' : ''}>Private by default</option>
              <option ${profile.privacyMode === 'Review every inferred path' ? 'selected' : ''}>Review every inferred path</option>
            </select>
          </label>
          <div class="trust-box">
            <strong>Why this matters</strong>
            <p class="small">LinkedIn is used only for identity in this MVP. Contacts and company-history overlap generate likely paths, and anything uncertain is marked for review before you act on it.</p>
          </div>
          <div class="action-row">
            <button class="primary" type="submit">Finish onboarding</button>
            <a class="button secondary" href="/app">Skip to the feed</a>
          </div>
        </form>
      </section>`
  });
}

function renderAppPage(session) {
  const matches = buildMatches(session.profile);
  const cards = matches.map((match) => `
    <article class="card op-card">
      <div class="action-row" style="justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="badge">${Math.round(match.overallScore * 100)} match</div>
          <h3 style="margin-top:10px;">${escapeHtml(match.title)}</h3>
          <p class="small">${escapeHtml(match.company.name)} · ${escapeHtml(match.location)} · Posted ${escapeHtml(match.postedAt)}</p>
        </div>
        <span class="confidence ${match.path?.confidence.tone || 'muted'}">${escapeHtml(match.path?.confidence.label || 'Needs review')}</span>
      </div>
      <p>${escapeHtml(match.summary)}</p>
      <div class="pill-row">${match.skills.map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`).join('')}</div>
      <div class="path-box">
        <strong>${escapeHtml(match.path?.warmthLabel || 'Possible path')}</strong>
        <p>${escapeHtml(match.path ? `Route: ${match.path.route.join(' → ')}` : 'No high-confidence warm path yet. Add or confirm a connector to improve this match.')}</p>
        <p class="small">${escapeHtml(match.fitSummary)}</p>
        ${match.path ? `<ul>${match.path.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="action-row">
        <a class="button primary" href="/opportunities/${match.id}">View path details</a>
        <a class="button secondary" href="/tracker">Prep outreach</a>
        <a class="button secondary" href="${escapeHtml(match.applyUrl)}" target="_blank" rel="noreferrer">View original listing</a>
      </div>
    </article>`).join('');

  return layout({
    title: 'GiftOfGab · Opportunity feed',
    session,
    activePath: '/app',
    body: `
      <section class="hero">
        <div class="panel hero-copy">
          <div class="eyebrow">Primary surface</div>
          <h1>Warm-path opportunity feed</h1>
          <p>Roles are ranked by the strongest credible route into the company first, with fit as a supporting signal. Confidence labels make it clear which paths are ready to use and which still need review.</p>
          <div class="stat-row">
            <div class="stat"><strong>${matches.length}</strong>Open roles</div>
            <div class="stat"><strong>${matches.filter((match) => match.path?.confidence.label === 'Confirmed').length}</strong>Confirmed paths</div>
            <div class="stat"><strong>${session.savedOpportunities.length}</strong>Saved opportunities</div>
          </div>
        </div>
        <aside class="panel">
          <h2>${escapeHtml(session.profile.fullName)}</h2>
          <p>${escapeHtml(session.profile.headline)}</p>
          <div class="trust-box">
            <strong>Trust scaffolding</strong>
            <ul>
              <li>Imported contacts stay private.</li>
              <li>Inferred paths are labeled before use.</li>
              <li>You can review or correct the network any time.</li>
            </ul>
          </div>
        </aside>
      </section>
      <section style="margin-top:24px;" class="grid cols-2">${cards}</section>`
  });
}

function renderOpportunityDetail(session, jobId) {
  const match = buildMatches(session.profile).find((item) => item.id === jobId);
  if (!match) return null;
  const isSaved = session.savedOpportunities.includes(jobId);
  const outreachItem = session.outreach.find((item) => item.jobId === jobId) || defaultOpportunityNotes.find((item) => item.jobId === jobId);
  return layout({
    title: `GiftOfGab · ${match.title}`,
    session,
    activePath: '/opportunities',
    body: `
      <section class="grid cols-2">
        <div class="panel hero-copy">
          <div class="action-row" style="justify-content:space-between; align-items:flex-start;">
            <div>
              <div class="eyebrow">Opportunity detail</div>
              <h1>${escapeHtml(match.title)}</h1>
              <p>${escapeHtml(match.company.name)} · ${escapeHtml(match.location)} · Posted ${escapeHtml(match.postedAt)}</p>
            </div>
            <span class="confidence ${match.path?.confidence.tone || 'muted'}">${escapeHtml(match.path?.confidence.label || 'Needs review')}</span>
          </div>
          <p>${escapeHtml(match.summary)}</p>
          <div class="pill-row">${match.skills.map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`).join('')}</div>
          <div class="trust-box" style="margin-top:16px;">
            <strong>Why this role is showing up</strong>
            <ul>
              <li>${escapeHtml(match.fitSummary)}</li>
              <li>${escapeHtml(match.path ? `Best route goes through ${match.path.connector}.` : 'No strong connector confirmed yet.')}</li>
              <li>${escapeHtml(match.path ? `${match.path.confidence.label} confidence based on available evidence.` : 'Review the network page to improve this path.')}</li>
            </ul>
          </div>
        </div>
        <aside class="panel">
          <h2>Believable next action</h2>
          <div class="path-box">
            <strong>${escapeHtml(match.path?.warmthLabel || 'Possible path')}</strong>
            <p>${escapeHtml(match.path ? match.path.route.join(' → ') : 'No route available')}</p>
            <ul>${(match.path?.evidence || ['No supporting evidence yet.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="action-row" style="margin-top:16px;">
            <form method="POST" action="/opportunities/${match.id}/save"><button class="primary" type="submit">${isSaved ? 'Saved' : 'Save opportunity'}</button></form>
            <a class="button secondary" href="/network">Review path quality</a>
          </div>
          <div class="trust-box" style="margin-top:16px;">
            <strong>Interim action flow</strong>
            <p class="small">Instead of a fake "Request intro" button, this MVP helps you prep the actual ask: confirm the connector, capture context, and track whether you reached out.</p>
          </div>
        </aside>
      </section>
      <section class="panel" style="margin-top:24px;">
        <div class="eyebrow">Outreach prep</div>
        <h2>Prep the introduction ask</h2>
        <p>${escapeHtml(match.path?.nextStep || 'Confirm a connector before drafting outreach.')}</p>
        <div class="timeline">
          <div>
            <strong>1. Confirm the relationship</strong>
            <p class="small">Check the network review page if the path is only likely or needs review.</p>
          </div>
          <div>
            <strong>2. Add context for the connector</strong>
            <p class="small">Include why this role fits and what kind of intro you want.</p>
          </div>
          <div>
            <strong>3. Track the outcome</strong>
            <p class="small">Move the opportunity to Intro requested, Follow-up, or Closed in the tracker.</p>
          </div>
        </div>
        <div class="trust-box" style="margin-top:18px;">
          <strong>Draft status</strong>
          <p class="small">${escapeHtml(outreachItem?.draft || 'No draft started yet.')}</p>
        </div>
      </section>`
  });
}

function renderNetworkPage(session) {
  const items = relationshipEdges.map((edge) => {
    const fromLabel = edge.from === 'candidate' ? session.profile.fullName : peopleMap.get(edge.from)?.name || edge.from;
    const toLabel = peopleMap.get(edge.to)?.name || edge.to;
    const confidence = scoreToConfidence(edge.strength);
    return `
      <li>
        <div class="action-row" style="justify-content:space-between; align-items:flex-start;">
          <div>
            <strong>${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</strong>
            <div class="small">${escapeHtml(edge.type)} · degree ${escapeHtml(edge.degree)}</div>
          </div>
          <span class="confidence ${confidence.tone}">${escapeHtml(confidence.label)}</span>
        </div>
        <p class="small">${escapeHtml(edge.evidence)}</p>
        <div class="action-row">
          <span class="button secondary">Mark confirmed</span>
          <span class="button secondary">Flag for review</span>
          <span class="button secondary">Remove from future suggestions</span>
        </div>
      </li>`;
  }).join('');

  return layout({
    title: 'GiftOfGab · Network review',
    session,
    activePath: '/network',
    body: `
      <section class="hero">
        <div class="panel hero-copy">
          <div class="eyebrow">Review and correct</div>
          <h1>Network review</h1>
          <p>This is where the app earns trust. Every inferred relationship is visible, confidence-labeled, and easy to challenge before it affects your next move.</p>
          <div class="trust-box">
            <strong>Privacy posture</strong>
            <ul>
              <li>Your graph is private to your account.</li>
              <li>Nothing is sent to employers or connectors automatically.</li>
              <li>You stay in control of which paths you actually use.</li>
            </ul>
          </div>
        </div>
        <aside class="panel">
          <h2>Source status</h2>
          <ul>
            <li><strong>LinkedIn:</strong> ${escapeHtml(session.profile.linkedInStatus)}</li>
            <li><strong>Contacts:</strong> ${escapeHtml(session.profile.contactsStatus)}</li>
            <li><strong>Manual review:</strong> available any time</li>
          </ul>
        </aside>
      </section>
      <section class="panel" style="margin-top:24px;">
        <h2>Known paths</h2>
        <ul class="list">${items}</ul>
      </section>`
  });
}

function renderProfilePage(session) {
  const profile = session.profile;
  return layout({
    title: 'GiftOfGab · Profile',
    session,
    activePath: '/profile',
    body: `
      <section class="grid cols-2">
        <div class="panel">
          <div class="eyebrow">Identity and preferences</div>
          <h1>Profile builder</h1>
          <p>Your profile tells the ranking system which leadership opportunities matter and gives connectors enough context to decide if they want to help.</p>
          <form method="POST" action="/profile">
            <div class="split">
              <label>Full name
                <input name="fullName" value="${escapeHtml(profile.fullName)}" />
              </label>
              <label>Email
                <input name="email" value="${escapeHtml(profile.email)}" />
              </label>
            </div>
            <label>Headline
              <input name="headline" value="${escapeHtml(profile.headline)}" />
            </label>
            <label>Target titles
              <input name="targetTitles" value="${escapeHtml(profile.targetTitles.join(', '))}" />
            </label>
            <label>Target locations
              <input name="targetLocations" value="${escapeHtml(profile.targetLocations.join(', '))}" />
            </label>
            <label>Strengths
              <input name="strengths" value="${escapeHtml(profile.strengths.join(', '))}" />
            </label>
            <label>Story
              <textarea name="story">${escapeHtml(profile.story)}</textarea>
            </label>
            <button class="primary" type="submit">Save profile</button>
          </form>
        </div>
        <aside class="panel">
          <h2>Trust state</h2>
          <div class="trust-box">
            <p><strong>LinkedIn:</strong> ${escapeHtml(profile.linkedInStatus)}</p>
            <p><strong>Contacts:</strong> ${escapeHtml(profile.contactsStatus)}</p>
            <p><strong>Privacy:</strong> ${escapeHtml(profile.privacyMode)}</p>
          </div>
          <div class="trust-box" style="margin-top:16px;">
            <strong>Profile completeness</strong>
            <p class="small">This MVP keeps profile data in memory for the current session. Real persistence and OAuth-backed identity are intentionally deferred until after the UX is validated.</p>
          </div>
        </aside>
      </section>`
  });
}

function renderTrackerPage(session) {
  const items = session.outreach.map((item) => {
    const job = jobsMap.get(item.jobId);
    return `
      <li>
        <div class="action-row" style="justify-content:space-between; align-items:flex-start;">
          <div>
            <strong>${escapeHtml(job?.title || item.jobId)}</strong>
            <div class="small">${escapeHtml(job?.companyId ? companyMap.get(job.companyId)?.name || job.companyId : '')}</div>
          </div>
          <span class="badge">${escapeHtml(item.status)}</span>
        </div>
        <p class="small">${escapeHtml(item.draft)}</p>
        <p class="small"><strong>Next:</strong> ${escapeHtml(item.nextStep)}</p>
      </li>`;
  }).join('');
  return layout({
    title: 'GiftOfGab · Outreach tracker',
    session,
    activePath: '/tracker',
    body: `
      <section class="panel">
        <div class="eyebrow">Momentum after discovery</div>
        <h1>Saved and outreach tracker</h1>
        <p>Once a role looks promising, the product should help you maintain momentum. This MVP gives you a lightweight tracker instead of pretending intros are already automated.</p>
        <ul class="list">${items}</ul>
      </section>`
  });
}

function renderApiState(session) {
  const matches = buildMatches(session.profile);
  return {
    user: session.user,
    onboardingComplete: session.onboardingComplete,
    profile: session.profile,
    matches,
    savedOpportunities: session.savedOpportunities,
    outreach: session.outreach
  };
}

function readFormUrlEncoded(raw) {
  return raw.split('&').reduce((acc, pair) => {
    if (!pair) return acc;
    const [key, value = ''] = pair.split('=');
    acc[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
    return acc;
  }, {});
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(readFormUrlEncoded(raw)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let session = getCurrentSession(req);

  if (req.method === 'GET' && url.pathname === '/') {
    if (session) {
      redirect(res, session.onboardingComplete ? '/app' : '/onboarding');
      return;
    }
    sendHtml(res, renderLoginPage());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/auth/login') {
    const form = await parseForm(req);
    const user = demoUsers[0];
    const newSession = createSession({
      ...user,
      name: form.fullName || user.name,
      email: form.email || user.email,
      profile: { ...user.profile, fullName: form.fullName || user.profile.fullName, email: form.email || user.profile.email, linkedInStatus: form.provider === 'linkedin' ? 'Connected for identity only' : 'Skipped for now' }
    });
    redirect(res, '/onboarding', { 'Set-Cookie': `gog_session=${newSession.id}; Path=/; HttpOnly; SameSite=Lax` });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/logout') {
    if (session) sessions.delete(session.id);
    redirect(res, '/', { 'Set-Cookie': 'gog_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax' });
    return;
  }

  if (!session) {
    redirect(res, '/');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/onboarding') {
    sendHtml(res, renderOnboardingPage(session));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/onboarding') {
    const form = await parseForm(req);
    applyProfileForm(session.profile, form);
    session.onboardingComplete = true;
    redirect(res, '/app');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/app') {
    sendHtml(res, renderAppPage(session));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/opportunities/')) {
    const jobId = url.pathname.split('/')[2];
    const page = renderOpportunityDetail(session, jobId);
    if (!page) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Opportunity not found');
      return;
    }
    sendHtml(res, page);
    return;
  }

  if (req.method === 'POST' && /\/opportunities\/[^/]+\/save$/.test(url.pathname)) {
    const jobId = url.pathname.split('/')[2];
    if (!session.savedOpportunities.includes(jobId)) session.savedOpportunities.push(jobId);
    redirect(res, `/opportunities/${jobId}`);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/network') {
    sendHtml(res, renderNetworkPage(session));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/profile') {
    sendHtml(res, renderProfilePage(session));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/profile') {
    const form = await parseForm(req);
    applyProfileForm(session.profile, form, { includeIdentity: true });
    redirect(res, '/profile');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/tracker') {
    sendHtml(res, renderTrackerPage(session));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/matches') {
    sendJson(res, 200, { matches: buildMatches(session.profile) });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/graph') {
    sendJson(res, 200, { companies, people, relationshipEdges });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/session') {
    sendJson(res, 200, renderApiState(session));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/session/profile') {
    try {
      const body = await parseBody(req);
      session.profile = { ...session.profile, ...body };
      sendJson(res, 200, { ok: true, profile: session.profile });
    } catch {
      sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`GiftOfGab MVP running at http://localhost:${port}`);
});
