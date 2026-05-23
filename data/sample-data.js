export const companies = [
  { id: 'respyro', name: 'ResPyro', domain: 'respyro.com', industry: 'SaaS', location: 'Remote' },
  { id: 'northstar', name: 'Northstar Health', domain: 'northstarhealth.com', industry: 'HealthTech', location: 'New York, NY' },
  { id: 'vectorforge', name: 'VectorForge', domain: 'vectorforge.ai', industry: 'AI Infrastructure', location: 'San Francisco, CA' }
];

export const jobs = [
  {
    id: 'job-1',
    companyId: 'respyro',
    title: 'Chief Product Officer',
    location: 'Remote (US)',
    postedAt: '2026-05-19',
    summary: 'Own product strategy for an AI-enabled workflow platform.',
    skills: ['Product strategy', 'Executive leadership', 'AI products'],
    applyUrl: 'https://example.com/jobs/job-1'
  },
  {
    id: 'job-2',
    companyId: 'northstar',
    title: 'VP of Operations',
    location: 'New York, NY',
    postedAt: '2026-05-18',
    summary: 'Lead cross-functional ops for a scaling care-delivery business.',
    skills: ['Operations', 'Team leadership', 'Healthcare'],
    applyUrl: 'https://example.com/jobs/job-2'
  },
  {
    id: 'job-3',
    companyId: 'vectorforge',
    title: 'Senior Product Marketing Manager',
    location: 'San Francisco, CA',
    postedAt: '2026-05-20',
    summary: 'Translate technical products into category-defining narratives.',
    skills: ['Product marketing', 'B2B SaaS', 'Storytelling'],
    applyUrl: 'https://example.com/jobs/job-3'
  }
];

export const people = [
  { id: 'person-1', name: 'Brandon Lee', companyId: 'respyro', title: 'Founder & CEO' },
  { id: 'person-2', name: 'Trent Adams', companyId: 'independent', title: 'Product Advisor' },
  { id: 'person-3', name: 'Sarah Chen', companyId: 'independent', title: 'VP Product' },
  { id: 'person-4', name: 'Maya Patel', companyId: 'northstar', title: 'Chief of Staff' },
  { id: 'person-5', name: 'Jules Ortega', companyId: 'vectorforge', title: 'Director of Marketing' },
  { id: 'person-6', name: 'Aisha Freeman', companyId: 'vectorforge', title: 'Head of Product' }
];

export const relationshipEdges = [
  {
    from: 'candidate',
    to: 'person-2',
    type: 'personal-contact',
    degree: 1,
    strength: 0.94,
    evidence: 'Imported from phone contacts and confirmed manually.'
  },
  {
    from: 'person-2',
    to: 'person-1',
    type: 'trusted-connector',
    degree: 2,
    strength: 0.88,
    evidence: 'Worked together on two startup launches.'
  },
  {
    from: 'candidate',
    to: 'person-4',
    type: 'former-coworker',
    degree: 1,
    strength: 0.81,
    evidence: 'Shared 3 years at Nimbus Labs.'
  },
  {
    from: 'candidate',
    to: 'person-5',
    type: 'google-contact',
    degree: 1,
    strength: 0.73,
    evidence: 'Email + calendar overlap in the last 18 months.'
  },
  {
    from: 'person-5',
    to: 'person-6',
    type: 'same-company',
    degree: 2,
    strength: 0.85,
    evidence: 'Current teammates at VectorForge.'
  }
];

export const demoUsers = [
  {
    id: 'demo-user',
    name: 'Alex Morgan',
    email: 'alex@example.com',
    onboardingComplete: false,
    profile: {
      fullName: 'Alex Morgan',
      email: 'alex@example.com',
      headline: 'Product and operations leader looking for warm-path executive roles',
      targetTitles: ['Chief Product Officer', 'VP Product', 'VP Operations'],
      targetLocations: ['Remote', 'New York, NY', 'San Francisco, CA'],
      strengths: ['Product strategy', 'Executive leadership', 'Operational scaling', 'AI products'],
      story: 'I help growth-stage companies scale product strategy and cross-functional execution.',
      privacyMode: 'Private by default',
      linkedInStatus: 'Connected for identity only',
      contactsStatus: 'Not connected yet'
    },
    savedOpportunities: ['job-1'],
    outreach: []
  }
];

export const defaultOpportunityNotes = [
  {
    jobId: 'job-1',
    status: 'Saved',
    draft: 'Ask Trent if he feels comfortable introducing me to Brandon and mention recent CPO work at Nimbus Labs.',
    nextStep: 'Confirm Trent is still close to Brandon.'
  },
  {
    jobId: 'job-2',
    status: 'Needs review',
    draft: 'Relationship looks real, but I should verify whether Maya is still involved in hiring.',
    nextStep: 'Review confidence and decide if direct outreach is appropriate.'
  }
];
