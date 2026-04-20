// Vanish Web — main entry point.
// Pure vanilla JS; no framework. Keep this file auditable.

import './styles.css';
import { runScan, buildShareCardSvg, getCatalog } from './lib/scan-runner.js';
import { svgToPngBlob, downloadBlob, svgStringToDataUrl } from './lib/svg-to-png.js';

const $ = (sel) => document.querySelector(sel);
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

const RISK_COLORS = {
  critical: '#ff3b30',
  high: '#ff9500',
  moderate: '#ffcc00',
  low: '#34c759'
};

let currentScanResult = null;
let currentShareSvg = null;

// ─── Scan handler ───────────────────────────────────────────────

document.getElementById('scan-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
  const identity = {
    fullName: (formData.get('fullName') || '').trim(),
    emails: formData.get('email') ? [formData.get('email').trim()] : [],
    phones: formData.get('phone') ? [formData.get('phone').trim()] : [],
    city: (formData.get('city') || '').trim() || null,
    state: (formData.get('state') || '').trim() || null,
    jurisdiction: formData.get('jurisdiction') || 'US'
  };

  if (!identity.fullName) return;

  // Tiny delay so the user sees the transition
  setTimeout(() => runAndRender(identity), 200);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  $('#hero').hidden = false;
  $('#results').hidden = true;
  currentScanResult = null;
  currentShareSvg = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function runAndRender(identity) {
  const result = runScan(identity);
  currentScanResult = result;
  currentShareSvg = buildShareCardSvg(result);

  $('#hero').hidden = true;
  $('#results').hidden = false;

  renderScoreCard(result);
  renderShareActions(result);
  renderExposureSummary(result);
  renderBrokerList(result);
  renderCliUpsell(result);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Rendering ──────────────────────────────────────────────────

function renderScoreCard(result) {
  const color = RISK_COLORS[result.riskLevel] || RISK_COLORS.moderate;
  const fillPct = Math.round((result.privacyScore / 100) * 100);

  $('#score-card').innerHTML = `
    <div class="score-label">Your Privacy Exposure Score</div>
    <div class="score-number" style="color: ${color}">${result.privacyScore}<span class="score-denom">/ 100</span></div>
    <div class="score-bar-bg">
      <div class="score-bar-fill" style="width: ${fillPct}%; background: ${color}"></div>
    </div>
    <div class="score-risk" style="color: ${color}">${escape(result.riskLevel.toUpperCase())} RISK</div>
    <div class="score-stats">
      <strong>${result.summary.likelyExposed}</strong> of ${result.summary.totalBrokers} brokers likely have your data
    </div>
  `;
}

function renderShareActions() {
  $('#share-actions').innerHTML = `
    <h3>Share your score (anonymous card, no personal info)</h3>
    <div class="share-buttons">
      <button type="button" id="btn-download-png" class="share-btn">📥 Download PNG</button>
      <button type="button" id="btn-download-svg" class="share-btn">📥 Download SVG</button>
      <button type="button" id="btn-copy-text" class="share-btn">📋 Copy share text</button>
    </div>
    <div class="share-preview">
      <img alt="Share card preview" src="${svgStringToDataUrl(currentShareSvg)}" />
    </div>
  `;

  $('#btn-download-png').addEventListener('click', handleDownloadPng);
  $('#btn-download-svg').addEventListener('click', handleDownloadSvg);
  $('#btn-copy-text').addEventListener('click', handleCopyText);
}

async function handleDownloadPng() {
  const btn = $('#btn-download-png');
  const original = btn.textContent;
  btn.textContent = '⏳ Rendering…';
  btn.disabled = true;
  try {
    const blob = await svgToPngBlob(currentShareSvg);
    downloadBlob(blob, `privacy-score-${currentScanResult.privacyScore}.png`);
    btn.textContent = '✓ Downloaded';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
  } catch (err) {
    console.error(err);
    btn.textContent = '✗ Failed (see console)';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2500);
  }
}

function handleDownloadSvg() {
  const blob = new Blob([currentShareSvg], { type: 'image/svg+xml' });
  downloadBlob(blob, `privacy-score-${currentScanResult.privacyScore}.svg`);
}

async function handleCopyText() {
  const text = `My Privacy Exposure Score is ${currentScanResult.privacyScore}/100 (${currentScanResult.riskLevel.toUpperCase()} RISK). ${currentScanResult.summary.likelyExposed} of ${currentScanResult.summary.totalBrokers} brokers likely have my data. Check yours: https://github.com/RAMBOXIE/vanish`;
  const btn = $('#btn-copy-text');
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✓ Copied';
  } catch {
    btn.textContent = '✗ Clipboard blocked';
  }
  setTimeout(() => { btn.textContent = original; }, 1500);
}

function renderExposureSummary(result) {
  const rows = Object.entries(result.summary.byCategory)
    .sort((a, b) => (b[1].likely || 0) - (a[1].likely || 0))
    .filter(([, c]) => c.likely + c.possible > 0)
    .map(([cat, c]) => `
      <tr>
        <td class="cat-name">${escape(humanizeCategory(cat))}</td>
        <td class="cat-num likely">${c.likely || 0}</td>
        <td class="cat-num possible">${c.possible || 0}</td>
        <td class="cat-num unlikely">${c.unlikely || 0}</td>
      </tr>
    `).join('');

  $('#exposure-summary').innerHTML = `
    <h2>Exposure breakdown</h2>
    <table class="cat-table">
      <thead>
        <tr><th>Category</th><th>Likely</th><th>Possible</th><th>Unlikely</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderBrokerList(result) {
  const catalog = getCatalog();

  // Pair each broker in the result with its catalog entry to find opt-out metadata
  const optOutCapable = result.exposures
    .filter((exp) => catalog.brokers[exp.broker]?.optOutFlow)
    .slice(0, 80);  // cap to keep the page scannable

  const html = optOutCapable.map((exp) => {
    const entry = catalog.brokers[exp.broker];
    const flow = entry.optOutFlow;
    const likelihoodBadge = `<span class="lh lh-${exp.likelihood}">${exp.likelihood}</span>`;

    const captchaInfo = flow.captcha ? `⚠️ Has ${flow.captcha}` : '✓ No captcha';
    const emailInfo = flow.emailVerification ? '✉️ Email verification' : '';
    const minutesInfo = flow.estimatedMinutes ? `~${flow.estimatedMinutes} min` : '';

    return `
      <article class="broker-card">
        <div class="broker-head">
          <h3>${escape(entry.displayName)}</h3>
          ${likelihoodBadge}
        </div>
        <div class="broker-meta">
          <span>${escape(humanizeCategory(entry.category))}</span>
          <span>${captchaInfo}</span>
          ${emailInfo ? `<span>${emailInfo}</span>` : ''}
          ${minutesInfo ? `<span>${minutesInfo}</span>` : ''}
        </div>
        <div class="broker-actions">
          <a class="broker-link" href="${escape(flow.optOutUrl)}" target="_blank" rel="noopener">
            Opt out on ${escape(new URL(flow.optOutUrl).hostname)} ↗
          </a>
        </div>
      </article>
    `;
  }).join('');

  $('#broker-list').innerHTML = `
    <h2>Start removing yourself</h2>
    <p class="broker-list-intro">
      ${optOutCapable.length} of ${result.exposures.length} brokers have a public opt-out page.
      Click to start. You'll need to solve captchas and click email verification links yourself.
    </p>
    <div class="broker-grid">${html}</div>
  `;
}

function renderCliUpsell(result) {
  const topBroker = result.exposures.find((e) => e.likelihood === 'likely')?.broker || 'spokeo';
  $('#cli-upsell').innerHTML = `
    <h2>Want automation?</h2>
    <p>The CLI bundles scan + guided opt-out + 30-day verify in one command.</p>
    <pre class="cli-code">npx github:RAMBOXIE/vanish opt-out --broker ${escape(topBroker)} --email you@example.com</pre>
    <p class="cli-footnote">
      The CLI opens your browser to each opt-out URL, pre-fills the form data, then checks back in 30 days to prove removal.
      <a href="https://github.com/RAMBOXIE/vanish" target="_blank" rel="noopener">Learn more on GitHub →</a>
    </p>
  `;
}

// ─── Helpers ────────────────────────────────────────────────────

function humanizeCategory(cat) {
  return ({
    'people-search': 'People Search',
    'background-check': 'Background Check',
    'phone-lookup': 'Phone Lookup',
    'public-records': 'Public Records',
    'marketing-data': 'Marketing Data',
    'financial': 'Financial',
    'location-data': 'Location Data',
    'email-data': 'Email Data',
    'social-media': 'Social Media',
    'reputation': 'Reputation',
    'identity-resolution': 'Identity Resolution',
    'property': 'Property'
  }[cat] || cat);
}
