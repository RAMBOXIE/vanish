// Browser-side wrapper around src/takedown/takedown-engine.mjs.
// The engine is already isomorphic (zero Node-specific deps), so we
// only need a thin import + a few result-shaping helpers.

import {
  renderLegalLetter as renderLegalLetterImpl,
  selectJurisdictionClause as selectJurisdictionClauseImpl,
  planDmcaNotices as planDmcaNoticesImpl
} from '@takedown/takedown-engine.mjs';
import takedownCatalog from '@takedown-catalog';

// Jurisdiction options exposed to the form selector.
// Order is intentional — most-common first.
export const JURISDICTION_OPTIONS = [
  { value: 'DMCA', label: 'US — DMCA §512(c) (default for content takedowns)' },
  { value: 'TAKE-IT-DOWN', label: 'US — Take It Down Act 2025 (NCII-specific)' },
  { value: 'SHIELD', label: 'US — SHIELD Act (federal stalking, 18 USC §2261A)' },
  { value: 'EU', label: 'EU — GDPR Article 17 (right to erasure)' },
  { value: 'UK', label: 'UK — Online Safety Act 2023' },
  { value: 'CA', label: 'Canada — Criminal Code §162.1 (NCII)' },
  { value: 'AU', label: 'Australia — Online Safety Act 2021' },
  { value: '', label: 'Generic (no specific jurisdiction citation)' }
];

export function getTakedownCatalog() {
  return takedownCatalog;
}

export function getLegalTemplates() {
  return Object.entries(takedownCatalog.legalTemplates || {}).map(([key, t]) => ({
    key,
    displayName: t.displayName,
    purpose: t.purpose
  }));
}

export function getLeakSites() {
  return Object.entries(takedownCatalog.leakSites || {}).map(([key, s]) => ({
    key,
    displayName: s.displayName,
    abuseContact: s.abuseContact,
    abuseContactIsEmail: looksLikeEmail(s.abuseContact),
    takedownDifficulty: s.takedownDifficulty,
    approach: s.approach,
    notes: s.notes
  }));
}

export function getCrisisSupport() {
  return Object.entries(takedownCatalog.support || {}).map(([key, s]) => ({
    key,
    displayName: s.displayName,
    url: s.url,
    type: s.type,
    contact: s.contact,
    description: s.description,
    countries: s.countries
  }));
}

export function getStopNciiWalkthrough() {
  const r = takedownCatalog.hashRegistries?.stopncii;
  if (!r) return null;
  return {
    serviceName: r.displayName,
    optOutUrl: r.url,
    walkthrough: {
      targetSetting: 'Hash registration',
      steps: r.walkthrough || [],
      verification: r.privacyNote || null,
      tierOverrides: r.caveat || null
    }
  };
}

export function getGoogleIntimateWalkthrough() {
  const e = takedownCatalog.searchEngines?.['google-intimate'];
  if (!e) return null;
  return {
    serviceName: e.displayName,
    optOutUrl: e.url,
    walkthrough: {
      targetSetting: 'Intimate-imagery removal request',
      steps: e.walkthrough || [],
      verification: e.jurisdictionNotes || e.notes || null
    }
  };
}

/**
 * Generate one DMCA letter per selected leak site.
 * Returns array of { site, displayName, abuseContact, takedownDifficulty, approach, letter }.
 */
export function generateDmcaBatch({ siteKeys, identity, infringingUrls, jurisdiction }) {
  if (!Array.isArray(siteKeys) || siteKeys.length === 0) return [];
  const flags = {
    name: identity?.fullName || '',
    email: identity?.email || '',
    jurisdiction: jurisdiction || 'DMCA',
    infringingUrls: infringingUrls || ''
  };
  const notices = planDmcaNoticesImpl(siteKeys, takedownCatalog, flags);

  // The engine doesn't substitute infringingUrls into the DMCA template by
  // default — fold it in here so users get a complete letter.
  if (infringingUrls) {
    for (const notice of notices) {
      notice.letter = notice.letter.replace(
        /\[list the URLs hosting the unauthorized content, one per line\]/g,
        infringingUrls
      );
    }
  }
  return notices.map((n) => ({
    ...n,
    abuseContactIsEmail: looksLikeEmail(n.abuseContact)
  }));
}

/**
 * Generate a single legal letter (cease-and-desist / police-report / civil-pre-suit / dmca-takedown).
 * Returns { templateKey, displayName, purpose, letter }.
 */
export function generateLetter({ templateKey, jurisdiction, vars }) {
  const flags = { jurisdiction };
  const jurisdictionClause = selectJurisdictionClauseImpl(flags, takedownCatalog);
  const merged = { ...(vars || {}), jurisdictionClause };
  return renderLegalLetterImpl(templateKey, merged, takedownCatalog);
}

function looksLikeEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
