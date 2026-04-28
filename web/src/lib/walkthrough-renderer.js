// Renders a step-by-step walkthrough panel for AI / Face opt-out flows.
// Pure DOM, vanilla JS, no framework. Matches the innerHTML + escape() pattern
// used in main.js. No localStorage; sessionStorage is opt-in per flow.

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

// Boilerplate legal texts users can paste directly into broker forms or emails.
// These are jurisdiction-aware but generic enough to work across services.
export const PREFILL_TEXTS = {
  gdprArticle17: 'I am exercising my right to erasure under Article 17 of the General Data Protection Regulation (GDPR). I request that you delete all personal data you hold about me, including but not limited to my name, photographs, biometric data, and any associated metadata. Please confirm completion within the 30-day deadline set by Article 12(3).',
  ccpaDeletion: 'I am exercising my right to deletion under California Civil Code §1798.105 (CCPA, as amended by CPRA). I request that you delete all personal information you have collected about me, including biometric data and any associated metadata. Please confirm completion within 45 days as required by §1798.130.'
};

const STORAGE_PREFIX = 'vanish:walkthrough:';
const PERSIST_FLAG_PREFIX = 'vanish:walkthrough-persist:';

function storageKey(flowKey) {
  return STORAGE_PREFIX + flowKey;
}

function persistKey(flowKey) {
  return PERSIST_FLAG_PREFIX + flowKey;
}

function hasSessionStorage() {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage !== null;
  } catch {
    return false;
  }
}

function isPersistenceEnabled(flowKey) {
  if (!hasSessionStorage()) return false;
  try {
    return sessionStorage.getItem(persistKey(flowKey)) === '1';
  } catch {
    return false;
  }
}

function setPersistenceEnabled(flowKey, enabled) {
  if (!hasSessionStorage()) return;
  try {
    if (enabled) sessionStorage.setItem(persistKey(flowKey), '1');
    else sessionStorage.removeItem(persistKey(flowKey));
  } catch {
    // sessionStorage may be unavailable (private mode quota etc.) — fail silently.
  }
}

function loadCompletion(flowKey) {
  if (!hasSessionStorage() || !isPersistenceEnabled(flowKey)) return {};
  try {
    const raw = sessionStorage.getItem(storageKey(flowKey));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCompletion(flowKey, completion) {
  if (!hasSessionStorage() || !isPersistenceEnabled(flowKey)) return;
  try {
    sessionStorage.setItem(storageKey(flowKey), JSON.stringify(completion));
  } catch {
    // Quota or disabled — silent.
  }
}

/**
 * Render a walkthrough panel into the given container.
 *
 * @param {HTMLElement} container - DOM node to render into
 * @param {Object} options
 * @param {string} options.flowKey - unique key for sessionStorage namespace
 *                                   (e.g. "ai:openai-chatgpt", "face:pimeyes:opt-out")
 * @param {string} options.serviceName - display name (e.g. "OpenAI ChatGPT")
 * @param {string} [options.optOutUrl] - URL the user opens in a new tab
 * @param {string} [options.optOutEmail] - opt-out email contact (PR 2.6: enables mailto: button)
 * @param {string} [options.optOutEmailSubject] - subject line for mailto link (defaults if not provided)
 * @param {Object} options.walkthrough - walkthrough object from catalog
 * @param {string} [options.walkthrough.targetSetting]
 * @param {string[]} options.walkthrough.steps
 * @param {string} [options.walkthrough.verification]
 * @param {string} [options.walkthrough.tierOverrides]
 * @param {Object} [options.identity] - pre-fill source from broker scan or user
 * @param {string} [options.identity.fullName]
 * @param {string} [options.identity.email]
 * @param {Function} [options.onClose] - called when user clicks the close button
 */
export function renderWalkthrough(container, options) {
  if (!container) return;
  const {
    flowKey, serviceName, optOutUrl, optOutEmail, optOutEmailSubject,
    walkthrough, identity, onClose
  } = options || {};

  if (!walkthrough || !Array.isArray(walkthrough.steps) || walkthrough.steps.length === 0) {
    container.innerHTML = '';
    return;
  }

  const completed = loadCompletion(flowKey);
  const persistOn = isPersistenceEnabled(flowKey);
  const stepsHtml = walkthrough.steps.map((step, i) => `
    <li class="walkthrough-step ${completed[i] ? 'done' : ''}" data-step-index="${i}">
      <label>
        <input type="checkbox" ${completed[i] ? 'checked' : ''} />
        <span class="walkthrough-step-text">${escape(step)}</span>
      </label>
    </li>
  `).join('');

  container.innerHTML = `
    <div class="walkthrough-panel" data-flow-key="${escape(flowKey || '')}">
      <header class="walkthrough-head">
        <h3>Walk-through: ${escape(serviceName || 'opt-out')}</h3>
        ${onClose ? '<button type="button" class="walkthrough-close" aria-label="Close walkthrough">×</button>' : ''}
      </header>
      ${optOutEmail ? `
        <p class="walkthrough-mailto">
          <a class="walkthrough-mailto-link" href="${buildMailtoHref({ email: optOutEmail, subject: optOutEmailSubject, serviceName, identity })}">
            📧 Open in email — ${escape(optOutEmail)}
          </a>
          <span class="walkthrough-link-hint">Skips the web form entirely. Pre-filled subject + body open in your default email client.</span>
        </p>
      ` : ''}
      ${optOutUrl ? `
        <p class="walkthrough-link">
          <a href="${escape(optOutUrl)}" target="_blank" rel="noopener">${optOutEmail ? 'Or open the privacy page ↗' : 'Open opt-out page ↗'}</a>
          <span class="walkthrough-link-hint">${optOutEmail ? 'Use this if you prefer a web form over email.' : 'Opens in a new tab; come back here to follow the steps.'}</span>
        </p>
      ` : ''}
      ${walkthrough.targetSetting ? `
        <p class="walkthrough-target">
          Target setting: <strong>"${escape(walkthrough.targetSetting)}"</strong>
        </p>
      ` : ''}
      <section class="walkthrough-prefill" aria-label="Reusable details for this opt-out">
        <h4>Your details (used by copy buttons below)</h4>
        <div class="walkthrough-prefill-inputs">
          <label class="walkthrough-prefill-input">
            <span>Name</span>
            <input type="text" class="walkthrough-prefill-name" value="${escape(identity?.fullName || '')}" placeholder="Your full name" autocomplete="off" />
          </label>
          <label class="walkthrough-prefill-input">
            <span>Email</span>
            <input type="email" class="walkthrough-prefill-email" value="${escape(identity?.email || '')}" placeholder="you@example.com" autocomplete="off" />
          </label>
        </div>
        <div class="walkthrough-prefill-buttons">
          <button type="button" class="walkthrough-copy-btn" data-copy="name">📋 Copy name</button>
          <button type="button" class="walkthrough-copy-btn" data-copy="email">📋 Copy email</button>
          <button type="button" class="walkthrough-copy-btn" data-copy="gdpr">📋 Copy GDPR Art. 17 text</button>
          <button type="button" class="walkthrough-copy-btn" data-copy="ccpa">📋 Copy CCPA §1798.105 text</button>
        </div>
        <p class="walkthrough-prefill-hint">
          Paste these into the broker's form. Vanish never sends them anywhere.
        </p>
      </section>
      <ol class="walkthrough-steps">${stepsHtml}</ol>
      ${walkthrough.verification ? `
        <div class="walkthrough-verification">
          <strong>How to confirm it worked:</strong> ${escape(walkthrough.verification)}
        </div>
      ` : ''}
      ${walkthrough.tierOverrides ? `
        <div class="walkthrough-tier-override">
          <strong>⚠ Caveat:</strong> ${escape(walkthrough.tierOverrides)}
        </div>
      ` : ''}
      <div class="walkthrough-progress">
        <label>
          <input type="checkbox" class="walkthrough-remember" ${persistOn ? 'checked' : ''} />
          <span>Remember my progress in this tab</span>
        </label>
        <span class="walkthrough-progress-hint">
          (Uses sessionStorage; cleared when you close this tab. Refresh = lost otherwise.)
        </span>
      </div>
    </div>
  `;

  // Step checkbox handlers
  container.querySelectorAll('.walkthrough-step input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const li = cb.closest('.walkthrough-step');
      const idx = Number(li.dataset.stepIndex);
      const next = { ...loadCompletion(flowKey) };
      next[idx] = cb.checked;
      saveCompletion(flowKey, next);
      li.classList.toggle('done', cb.checked);
    });
  });

  // Persistence toggle handler
  const rememberCb = container.querySelector('.walkthrough-remember');
  if (rememberCb) {
    rememberCb.addEventListener('change', () => {
      setPersistenceEnabled(flowKey, rememberCb.checked);
      if (rememberCb.checked) {
        // Capture current step state at the moment user enables persistence.
        const current = {};
        container.querySelectorAll('.walkthrough-step input[type="checkbox"]').forEach((box, i) => {
          current[i] = box.checked;
        });
        saveCompletion(flowKey, current);
      } else if (hasSessionStorage()) {
        try {
          sessionStorage.removeItem(storageKey(flowKey));
        } catch {
          // ignore
        }
      }
    });
  }

  // Close button handler
  if (onClose) {
    const closeBtn = container.querySelector('.walkthrough-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        container.innerHTML = '';
        onClose();
      });
    }
  }

  // Copy-to-clipboard handlers (PR 2.5: kill the "retype name 8 times" friction)
  const nameInput = container.querySelector('.walkthrough-prefill-name');
  const emailInput = container.querySelector('.walkthrough-prefill-email');
  container.querySelectorAll('.walkthrough-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.copy;
      let text = '';
      if (kind === 'name') text = nameInput?.value?.trim() || '';
      else if (kind === 'email') text = emailInput?.value?.trim() || '';
      else if (kind === 'gdpr') text = PREFILL_TEXTS.gdprArticle17;
      else if (kind === 'ccpa') text = PREFILL_TEXTS.ccpaDeletion;

      const original = btn.textContent;
      if (!text) {
        btn.textContent = '⚠ Empty — type it above first';
        setTimeout(() => { btn.textContent = original; }, 1600);
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '✓ Copied';
      } catch {
        btn.textContent = '✗ Copy failed';
      }
      setTimeout(() => { btn.textContent = original; }, 1400);
    });
  });
}

/**
 * Build a mailto: href with prefilled subject + body. Uses encodeURIComponent
 * (NOT escape() — escape() is for HTML-attribute safety; mailto query strings
 * need URI encoding instead). The result is then HTML-escaped at the call site
 * to defend against `&` corruption when interpolated into innerHTML.
 *
 * @param {{ email: string, subject?: string, serviceName?: string, identity?: { fullName?: string, email?: string } }} args
 * @returns {string} HTML-escaped mailto: href safe to interpolate into innerHTML
 */
export function buildMailtoHref({ email, subject, serviceName, identity }) {
  if (!email) return '';
  const finalSubject = subject || `Privacy / opt-out request — ${serviceName || 'your platform'}`;
  const lines = [
    'Hello,',
    '',
    `I am submitting a formal request to opt out of my data being used by ${serviceName || 'your platform'} for AI training, model improvement, or any similar processing not strictly required to provide the service to me.`,
    '',
    'I am exercising my rights under, as applicable:',
    ' - GDPR Article 21 (right to object) and Article 17 (right to erasure) — EU/UK/Swiss/EEA users',
    ' - California Civil Code §1798.105 (right to deletion) and §1798.120 (right to opt out of sale/sharing) — California users',
    ' - Equivalent rights under PIPEDA (Canada), LGPD (Brazil), or local data-protection law',
    '',
    'Please:',
    ' 1. Stop processing my data for AI training and confirm in writing.',
    ' 2. Confirm receipt within 30 days (GDPR Article 12(3)) or 45 days (CCPA §1798.130).',
    ' 3. Provide a case reference number for follow-up.',
    ''
  ];
  if (identity?.fullName) lines.push(`Account name: ${identity.fullName}`);
  if (identity?.email) lines.push(`Account email: ${identity.email}`);
  lines.push('');
  lines.push('Thank you,');
  lines.push(identity?.fullName || '[your name]');
  lines.push('');
  lines.push('— Drafted with vanish (https://github.com/RAMBOXIE/vanish). Signed and sent by me.');

  const body = lines.join('\n');
  const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(body)}`;
  // HTML-attribute escape so `&` etc. don't break the href when injected via innerHTML.
  return String(href).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Clear all walkthrough state for a single flow key. */
export function clearWalkthroughState(flowKey) {
  if (!hasSessionStorage()) return;
  try {
    sessionStorage.removeItem(storageKey(flowKey));
    sessionStorage.removeItem(persistKey(flowKey));
  } catch {
    // ignore
  }
}
