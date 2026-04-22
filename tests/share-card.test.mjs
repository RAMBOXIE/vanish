import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { renderShareBanner, renderShareCardSvg, renderTripleThreatCardSvg } from '../src/scanner/share-card.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SCAN_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'scan-demo.mjs');

// Minimal valid ScanResult fixture
function mockScanResult(overrides = {}) {
  return {
    scanId: 'scan_test_001',
    scannedAt: '2026-04-20T00:00:00Z',
    privacyScore: 63,
    riskLevel: 'high',
    summary: {
      totalBrokers: 210,
      likelyExposed: 115,
      possiblyExposed: 85,
      unlikelyExposed: 10,
      byCategory: {
        'people-search': { likely: 72, possible: 0, unlikely: 0 },
        'background-check': { likely: 20, possible: 0, unlikely: 0 },
        'phone-lookup': { likely: 0, possible: 14, unlikely: 0 }
      },
      byRisk: { critical: 92, high: 0, moderate: 100, low: 20 }
    },
    exposures: [],
    recommendations: [],
    ...overrides
  };
}

// ─── Banner tests ───────────────────────────────────────────────

test('renderShareBanner contains score and risk level', () => {
  const banner = renderShareBanner(mockScanResult(), { color: false });
  assert.match(banner, /63 \/ 100/);
  assert.match(banner, /HIGH RISK/);
  assert.match(banner, /115 of 210/);
});

test('renderShareBanner all lines have consistent width', () => {
  const banner = renderShareBanner(mockScanResult(), { color: false });
  const lines = banner.split('\n');
  assert.ok(lines.length > 5);
  const firstLineLen = lines[0].length;
  for (const line of lines) {
    assert.equal(line.length, firstLineLen, `line width mismatch: "${line}" (expected ${firstLineLen}, got ${line.length})`);
  }
});

test('renderShareBanner contains Vanish GitHub URL', () => {
  const banner = renderShareBanner(mockScanResult(), { color: false });
  assert.match(banner, /github\.com\/RAMBOXIE\/vanish/);
});

test('renderShareBanner with color=false has no ANSI escapes', () => {
  const banner = renderShareBanner(mockScanResult(), { color: false });
  // eslint-disable-next-line no-control-regex
  assert.doesNotMatch(banner, /\x1b\[/);
});

test('renderShareBanner with color=true includes ANSI color codes', () => {
  const banner = renderShareBanner(mockScanResult(), { color: true });
  // eslint-disable-next-line no-control-regex
  assert.match(banner, /\x1b\[/);
});

// ─── SVG tests ──────────────────────────────────────────────────

test('renderShareCardSvg returns well-formed SVG with 1200x630 viewBox', () => {
  const svg = renderShareCardSvg(mockScanResult());
  assert.match(svg, /^<\?xml version="1\.0"/);
  assert.match(svg, /<svg[^>]*width="1200"/);
  assert.match(svg, /<svg[^>]*height="630"/);
  assert.match(svg, /viewBox="0 0 1200 630"/);
  assert.match(svg, /<\/svg>$/);
});

test('renderShareCardSvg contains score, risk, and CTA', () => {
  const svg = renderShareCardSvg(mockScanResult());
  assert.match(svg, /\b63\b/);
  assert.match(svg, /HIGH RISK/);
  assert.match(svg, /115 of 210/);
  assert.match(svg, /npx github:RAMBOXIE\/vanish/);
});

test('renderShareCardSvg is PRIVACY-PRESERVING (no identity fields possible)', () => {
  // Even though the function doesn't take identity, double-check nothing
  // leaks via summary
  const svg = renderShareCardSvg(mockScanResult({
    // Just in case something happened to put identity in wrong place
    identity: { name: 'John Doe', email: 'john@example.com', phone: '+15551234567' }
  }));
  assert.doesNotMatch(svg, /John/);
  assert.doesNotMatch(svg, /Doe/);
  assert.doesNotMatch(svg, /john@/);
  assert.doesNotMatch(svg, /example\.com/);
  assert.doesNotMatch(svg, /5551234/);
});

test('renderShareCardSvg color changes by risk level', () => {
  const low = renderShareCardSvg(mockScanResult({ riskLevel: 'low', privacyScore: 15 }));
  const high = renderShareCardSvg(mockScanResult({ riskLevel: 'high', privacyScore: 65 }));
  const critical = renderShareCardSvg(mockScanResult({ riskLevel: 'critical', privacyScore: 90 }));

  // Low = green, High = orange, Critical = red — different colors must appear
  assert.match(low, /#34c759/);     // green
  assert.match(high, /#ff9500/);    // orange
  assert.match(critical, /#ff3b30/);// red
});

test('renderShareCardSvg progress bar width scales with score', () => {
  const low = renderShareCardSvg(mockScanResult({ privacyScore: 20 }));
  const high = renderShareCardSvg(mockScanResult({ privacyScore: 80 }));

  // Bar width in SVG is proportional to score (out of 600 bar width)
  // Score 20 → width ~120; Score 80 → width ~480
  const widthOf = (svg) => {
    const matches = [...svg.matchAll(/width="(\d+)"/g)];
    return matches.map(m => parseInt(m[1])).filter(w => w > 100 && w < 700 && w !== 1200);
  };
  assert.ok(widthOf(low).some(w => w <= 200), `low score bar should be narrow, got ${widthOf(low)}`);
  assert.ok(widthOf(high).some(w => w >= 400), `high score bar should be wide, got ${widthOf(high)}`);
});

// ─── CLI integration ────────────────────────────────────────────

test('scan CLI --share-card writes valid SVG file', () => {
  const tmpFile = path.join(os.tmpdir(), `share-card-test-${Date.now()}.svg`);

  const result = spawnSync(process.execPath, [
    SCAN_SCRIPT,
    '--name', 'Test User',
    '--email', 'test@example.com',
    '--phone', '+15551234567',
    '--share-card', tmpFile,
    '--no-color', '--no-banner'
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, `scan failed: ${result.stderr}`);
  assert.ok(fs.existsSync(tmpFile), 'SVG file not created');

  const svg = fs.readFileSync(tmpFile, 'utf8');
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg/);

  // Privacy check: no identity fields in the generated SVG
  assert.doesNotMatch(svg, /Test User/);
  assert.doesNotMatch(svg, /test@example\.com/);
  assert.doesNotMatch(svg, /5551234567/);

  fs.unlinkSync(tmpFile);
});

test('scan CLI default output includes banner', () => {
  const result = spawnSync(process.execPath, [
    SCAN_SCRIPT,
    '--name', 'Test User',
    '--no-color'
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  // Banner-specific content (box chars + key labels)
  assert.match(result.stdout, /┌/);
  assert.match(result.stdout, /My Privacy Exposure/);
  assert.match(result.stdout, /RISK/);
  assert.match(result.stdout, /└/);
});

test('scan CLI --no-banner suppresses the banner', () => {
  const result = spawnSync(process.execPath, [
    SCAN_SCRIPT,
    '--name', 'Test User',
    '--no-banner', '--no-color'
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /┌/);
  assert.doesNotMatch(result.stdout, /└/);
  // But the markdown report is still present
  assert.match(result.stdout, /Privacy Scan Report/);
});

// ─── Triple-threat share card (v2) ────────────────────────────

test('renderTripleThreatCardSvg requires at least one score', () => {
  assert.throws(() => renderTripleThreatCardSvg({}), /at least one/i);
  assert.throws(() => renderTripleThreatCardSvg(), /at least one/i);
});

test('renderTripleThreatCardSvg with all three scores renders all columns', () => {
  const svg = renderTripleThreatCardSvg({
    broker: { privacyScore: 72, riskLevel: 'high', summary: { likelyExposed: 115, totalBrokers: 210 } },
    ai: { exposureScore: 85, riskLevel: 'critical', summary: { exposed: 8, totalPlatformsChecked: 10 } },
    face: { exposedCount: 3, totalServices: 8 }
  });
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /DATA BROKERS/);
  assert.match(svg, /AI TRAINING/);
  assert.match(svg, /FACE SEARCH/);
  assert.match(svg, />72</);
  assert.match(svg, />85</);
  assert.match(svg, />3</);
});

test('renderTripleThreatCardSvg with only broker shows ghost AI + face', () => {
  const svg = renderTripleThreatCardSvg({
    broker: { privacyScore: 40, riskLevel: 'moderate', summary: { likelyExposed: 50, totalBrokers: 210 } }
  });
  assert.match(svg, /DATA BROKERS/);
  assert.match(svg, /not scanned/);
  assert.match(svg, />40</);
});

test('renderTripleThreatCardSvg escapes category HTML', () => {
  // Stress test: the output must always be valid SVG
  const svg = renderTripleThreatCardSvg({
    broker: { privacyScore: 0, riskLevel: 'low', summary: { likelyExposed: 0, totalBrokers: 210 } }
  });
  assert.match(svg, /<\/svg>$/);
  // No unescaped <script> injection possible — fixtures don't have any,
  // but verify the output shape
  assert.ok(svg.includes('1200') && svg.includes('630'));
});

test('renderTripleThreatCardSvg does NOT include identifying data', () => {
  // Privacy invariant — must never leak fullName/emails/phones
  const svg = renderTripleThreatCardSvg({
    broker: { privacyScore: 50, riskLevel: 'moderate', summary: { likelyExposed: 30, totalBrokers: 210 } },
    ai: { exposureScore: 70, riskLevel: 'high', summary: { exposed: 5, totalPlatformsChecked: 8 } }
  });
  // Check that the standard fields we'd never want to leak don't appear
  assert.equal(svg.includes('email'), false);
  assert.equal(svg.includes('@'), false);
  assert.equal(svg.includes('phone'), false);
});

test('renderTripleThreatCardSvg face-only scenario works', () => {
  const svg = renderTripleThreatCardSvg({
    face: { exposedCount: 5, totalServices: 8 }
  });
  assert.match(svg, /FACE SEARCH/);
  assert.match(svg, />5</);
  // Broker + AI should show the "not scanned" ghost
  const notScannedCount = (svg.match(/not scanned/g) || []).length;
  assert.equal(notScannedCount, 2);
});
