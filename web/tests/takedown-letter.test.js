// Tests for the browser-side takedown wrapper. Verifies that
// renderLegalLetter, generateDmcaBatch, and the catalog getters all
// behave correctly when imported in a browser context (jsdom).

import { describe, test, expect } from 'vitest';
import {
  JURISDICTION_OPTIONS,
  getTakedownCatalog,
  getLegalTemplates,
  getLeakSites,
  getCrisisSupport,
  getStopNciiWalkthrough,
  getGoogleIntimateWalkthrough,
  generateDmcaBatch,
  generateLetter
} from '../src/lib/takedown-letter.js';

describe('takedown-letter library', () => {
  test('catalog getters return non-empty data', () => {
    const cat = getTakedownCatalog();
    expect(cat.legalTemplates).toBeTruthy();
    expect(cat.leakSites).toBeTruthy();
    expect(cat.support).toBeTruthy();
    expect(cat.searchEngines).toBeTruthy();
    expect(cat.hashRegistries).toBeTruthy();
  });

  test('getLegalTemplates returns all 4 expected templates', () => {
    const templates = getLegalTemplates();
    const keys = templates.map((t) => t.key).sort();
    expect(keys).toEqual([
      'cease-and-desist',
      'civil-pre-suit',
      'dmca-takedown',
      'police-report'
    ]);
  });

  test('getLeakSites returns 12 sites with expected shape', () => {
    const sites = getLeakSites();
    expect(sites.length).toBe(12);
    for (const site of sites) {
      expect(site.key).toBeTruthy();
      expect(site.displayName).toBeTruthy();
      expect(site.abuseContact).toBeTruthy();
      expect(['easy', 'easy-to-medium', 'medium', 'hard']).toContain(site.takedownDifficulty);
      expect(typeof site.abuseContactIsEmail).toBe('boolean');
    }
  });

  test('email vs URL detection in abuseContact', () => {
    const sites = getLeakSites();
    // thothub abuseContact is an email (dmca@thothub.tv) per catalog
    const thothub = sites.find((s) => s.key === 'thothub');
    expect(thothub?.abuseContactIsEmail).toBe(true);
    // coomer's is a URL
    const coomer = sites.find((s) => s.key === 'coomer');
    expect(coomer?.abuseContactIsEmail).toBe(false);
  });

  test('getCrisisSupport returns 4 resources with phone numbers', () => {
    const support = getCrisisSupport();
    expect(support.length).toBeGreaterThanOrEqual(4);
    const ccri = support.find((s) => s.key === 'ccri-hotline');
    expect(ccri).toBeTruthy();
    expect(ccri.contact).toMatch(/CCRI|2274/);
    expect(ccri.countries).toContain('US');
  });

  test('getStopNciiWalkthrough returns walkthrough-shaped object', () => {
    const sn = getStopNciiWalkthrough();
    expect(sn).toBeTruthy();
    expect(sn.serviceName).toMatch(/StopNCII/);
    expect(sn.optOutUrl).toMatch(/stopncii\.org/);
    expect(Array.isArray(sn.walkthrough.steps)).toBe(true);
    expect(sn.walkthrough.steps.length).toBeGreaterThan(0);
  });

  test('getGoogleIntimateWalkthrough returns walkthrough-shaped object', () => {
    const g = getGoogleIntimateWalkthrough();
    expect(g).toBeTruthy();
    expect(g.optOutUrl).toMatch(/google\.com/);
    expect(g.walkthrough.steps.length).toBeGreaterThan(0);
  });

  test('JURISDICTION_OPTIONS includes the major jurisdictions', () => {
    const values = JURISDICTION_OPTIONS.map((o) => o.value);
    expect(values).toContain('DMCA');
    expect(values).toContain('EU');
    expect(values).toContain('UK');
    expect(values).toContain('SHIELD');
    expect(values).toContain('TAKE-IT-DOWN');
  });
});

describe('generateDmcaBatch', () => {
  test('generates one letter per selected site, with abuse contact', () => {
    const notices = generateDmcaBatch({
      siteKeys: ['coomer', 'thothub'],
      identity: { fullName: 'Jane Doe', email: 'jane@example.com' },
      infringingUrls: 'https://coomer.su/onlyfans/user/jane\nhttps://thothub.tv/videos/12345',
      jurisdiction: 'DMCA'
    });
    expect(notices.length).toBe(2);
    expect(notices[0].site).toBe('coomer');
    expect(notices[1].site).toBe('thothub');
    for (const n of notices) {
      expect(n.letter).toMatch(/Jane Doe/);
      expect(n.letter).toMatch(/jane@example\.com/);
      expect(n.letter).toContain(n.abuseContact);
    }
  });

  test('substitutes the infringingUrls placeholder', () => {
    const notices = generateDmcaBatch({
      siteKeys: ['thothub'],
      identity: { fullName: 'Test', email: 'test@example.com' },
      infringingUrls: 'https://thothub.tv/videos/specific-leaked-url',
      jurisdiction: 'DMCA'
    });
    expect(notices[0].letter).toContain('https://thothub.tv/videos/specific-leaked-url');
    expect(notices[0].letter).not.toContain('[list the URLs hosting');
  });

  test('returns empty array when no siteKeys passed', () => {
    expect(generateDmcaBatch({ siteKeys: [], identity: {}, infringingUrls: '', jurisdiction: 'DMCA' })).toEqual([]);
    expect(generateDmcaBatch({ siteKeys: null })).toEqual([]);
  });

  test('DMCA template stays US §512(c) regardless of jurisdiction (use cease-and-desist for EU)', () => {
    // The DMCA template is the US copyright statute — it doesn't mutate per
    // jurisdiction. Users wanting GDPR Article 17 framing should use step 4's
    // cease-and-desist or civil-pre-suit templates instead.
    const usNotice = generateDmcaBatch({
      siteKeys: ['coomer'],
      identity: { fullName: 'Test', email: 'test@example.com' },
      infringingUrls: 'https://example.com',
      jurisdiction: 'DMCA'
    });
    const euNotice = generateDmcaBatch({
      siteKeys: ['coomer'],
      identity: { fullName: 'Test', email: 'test@example.com' },
      infringingUrls: 'https://example.com',
      jurisdiction: 'EU'
    });
    // Both should still cite §512(c) — that's the DMCA statute identifier
    expect(usNotice[0].letter).toMatch(/§512\(c\)/);
    expect(euNotice[0].letter).toMatch(/§512\(c\)/);
  });
});

describe('generateLetter (single-template letters)', () => {
  test('cease-and-desist substitutes recipient + jurisdiction', () => {
    const result = generateLetter({
      templateKey: 'cease-and-desist',
      jurisdiction: 'SHIELD',
      vars: {
        yourName: 'Jane Doe',
        yourEmail: 'jane@example.com',
        recipientName: 'John Smith',
        recipientEmail: 'john@example.com'
      }
    });
    expect(result.letter).toMatch(/Jane Doe/);
    expect(result.letter).toMatch(/John Smith/);
    expect(result.letter).toMatch(/SHIELD|Stalking|2261A/i);
  });

  test('police-report renders incident date + state statute', () => {
    const result = generateLetter({
      templateKey: 'police-report',
      jurisdiction: '',
      vars: {
        yourName: 'Jane Doe',
        incidentDate: '2026-04-26',
        channelsList: 'https://thothub.tv/videos/12345',
        suspectInfo: 'unknown — subpoena required',
        stateStatute: 'Cal. Penal Code §647(j)(4)'
      }
    });
    expect(result.letter).toContain('Jane Doe');
    expect(result.letter).toContain('2026-04-26');
    expect(result.letter).toContain('Cal. Penal Code §647(j)(4)');
  });

  test('civil-pre-suit substitutes recipient + warning', () => {
    const result = generateLetter({
      templateKey: 'civil-pre-suit',
      jurisdiction: 'DMCA',
      vars: {
        yourName: 'Jane Doe',
        yourEmail: 'jane@example.com',
        recipientName: 'Acme Aggregator LLC',
        recipientEmail: 'legal@acme.com'
      }
    });
    expect(result.letter).toContain('Acme Aggregator LLC');
    expect(result.templateKey).toBe('civil-pre-suit');
  });

  test('throws on unknown template key', () => {
    expect(() =>
      generateLetter({ templateKey: 'nonexistent', jurisdiction: '', vars: {} })
    ).toThrow();
  });

  test('missing vars fall back to [bracket] form', () => {
    const result = generateLetter({
      templateKey: 'cease-and-desist',
      jurisdiction: '',
      vars: { yourName: 'Jane Doe' }
    });
    // Unfilled vars become [name] readable form
    expect(result.letter).toMatch(/\[recipient/i);
  });
});
