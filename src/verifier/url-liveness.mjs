// URL liveness checker - tells us if a broker profile URL is still present,
// removed, or in an unknown state.

const DEFAULT_USER_AGENT = 'Vanish-Verify/1.0 (opt-out verification; https://github.com/RAMBOXIE/vanish)';
const TIMEOUT_MS = 15_000;
const MAX_BODY_CHARS = 250_000;

const CAPTCHA_MARKERS = [
  'captcha',
  'recaptcha',
  'hcaptcha',
  'cf-turnstile',
  'turnstile',
  'verify you are human',
  'verify you are a human',
  'security check',
  'security challenge',
  'checking your browser',
  'automated access',
  'access denied'
];

const REMOVED_MARKERS = [
  'page not found',
  'profile not found',
  'record not found',
  'records not found',
  'no record found',
  'no records found',
  'no result found',
  'no results found',
  'listing removed',
  'profile has been removed',
  'page is no longer available',
  'sorry, this page is unavailable',
  'we could not find the page',
  'requested url was not found',
  '404 not found'
];

const GENERIC_LANDING_MARKERS = [
  'people search',
  'find people',
  'search public records',
  'background checks',
  'public records search',
  'start your search'
];

const PROFILE_MARKERS = [
  'possible relatives',
  'known aliases',
  'current address',
  'previous addresses',
  'phone numbers',
  'email addresses',
  'lives in'
];

const PATH_TOKEN_STOP_WORDS = new Set([
  'www',
  'com',
  'profile',
  'profiles',
  'person',
  'people',
  'search',
  'find',
  'record',
  'records',
  'listing',
  'detail',
  'details',
  'report',
  'reports',
  'background',
  'check',
  'checks',
  'public',
  'lookup',
  'directory',
  'page',
  'view',
  'home',
  'index',
  'result',
  'results'
]);

/**
 * Classify what we think happened with a broker profile URL.
 *
 * @param {string} profileUrl
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=15000]
 * @param {string} [options.userAgent]
 * @param {Function} [options.fetchImpl] - override for testing
 * @returns {Promise<{ status, httpStatus, finalUrl, redirected, reason, pageTitle }>}
 */
export async function checkLiveness(profileUrl, options = {}) {
  if (!profileUrl) {
    return { status: 'unknown', reason: 'no-url-provided', pageTitle: null };
  }

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(profileUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': userAgent, accept: 'text/html' },
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { status: 'unknown', reason: 'timeout', error: 'timeout', pageTitle: null };
    }
    return { status: 'unknown', reason: 'network-error', error: err.message, pageTitle: null };
  }
  clearTimeout(timeout);

  const httpStatus = response.status;
  const finalUrl = response.url || profileUrl;
  const redirected = finalUrl !== profileUrl;
  const body = await safeReadBody(response);
  const pageTitle = extractTitle(body);

  if (httpStatus === 404 || httpStatus === 410) {
    return { status: 'removed', httpStatus, finalUrl, redirected, reason: `http-${httpStatus}`, pageTitle };
  }

  if (redirected && isRootLikeUrl(finalUrl, profileUrl)) {
    return { status: 'removed', httpStatus, finalUrl, redirected, reason: 'redirected-to-root', pageTitle };
  }

  if (httpStatus === 403 || httpStatus === 429) {
    const captchaMarker = findMarker(searchablePageText(body, pageTitle), CAPTCHA_MARKERS);
    return {
      status: 'unknown',
      httpStatus,
      finalUrl,
      redirected,
      reason: captchaMarker ? `http-${httpStatus}-captcha-or-ratelimit` : `http-${httpStatus}-access-blocked`,
      pageTitle
    };
  }

  if (httpStatus >= 500) {
    return { status: 'unknown', httpStatus, finalUrl, redirected, reason: `http-${httpStatus}-server-error`, pageTitle };
  }

  const htmlSignal = classifyHtmlSignals({
    profileUrl,
    finalUrl,
    redirected,
    httpStatus,
    body,
    pageTitle
  });

  if (htmlSignal) {
    return {
      status: htmlSignal.status,
      httpStatus,
      finalUrl,
      redirected,
      reason: htmlSignal.reason,
      pageTitle
    };
  }

  if (httpStatus === 200 && !redirected) {
    return { status: 'still-present', httpStatus, finalUrl, redirected, reason: 'http-200-same-url', pageTitle };
  }

  if (httpStatus === 200 && redirected) {
    return { status: 'unknown', httpStatus, finalUrl, redirected, reason: 'http-200-redirected-to-different-path', pageTitle };
  }

  return { status: 'unknown', httpStatus, finalUrl, redirected, reason: `http-${httpStatus}-other`, pageTitle };
}

function isRootLikeUrl(finalUrl, originalUrl) {
  try {
    const final = new URL(finalUrl);
    const orig = new URL(originalUrl);

    if (final.host !== orig.host) return true;

    const path = final.pathname.replace(/\/$/, '');
    if (path === '' || path === '/') return true;
    if (['/home', '/index', '/index.html', '/search'].includes(path)) return true;

    const origPath = orig.pathname.replace(/\/$/, '');
    if (origPath.length > 20 && path.length < origPath.length / 3) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Batch verify multiple followUp entries.
 *
 * @param {Array} entries - followUp array from state-store
 * @param {Object} options
 * @param {Function} [options.onProgress] - (entry, result) => void
 * @param {number} [options.delayMs=1500] - jitter delay between checks
 * @returns {Promise<Array>} updated entries with verification fields
 */
export async function verifyEntries(entries, options = {}) {
  const delayMs = options.delayMs ?? 1500;
  const fetchImpl = options.fetchImpl;
  const updated = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const result = await checkLiveness(entry.profileUrl, { fetchImpl });

    const now = new Date().toISOString();
    const nextEntry = {
      ...entry,
      verifiedAt: now,
      verificationResult: result.status,
      verificationReason: result.reason || null,
      verificationHttpStatus: result.httpStatus ?? null,
      verificationFinalUrl: result.finalUrl ?? null,
      verificationPageTitle: result.pageTitle ?? null,
      status: statusFromResult(entry.status, result.status)
    };

    updated.push(nextEntry);
    if (options.onProgress) options.onProgress(entry, result);

    if (delayMs > 0 && index < entries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs + Math.floor(Math.random() * 500)));
    }
  }

  return updated;
}

function statusFromResult(currentStatus, verificationResult) {
  if (verificationResult === 'removed') return 'verified-removed';
  if (verificationResult === 'still-present') return 'still-present';
  return currentStatus || 'pending-verification';
}

async function safeReadBody(response) {
  if (!response || typeof response.text !== 'function') {
    return '';
  }

  try {
    const text = await response.text();
    return String(text || '').slice(0, MAX_BODY_CHARS);
  } catch {
    return '';
  }
}

function classifyHtmlSignals({ profileUrl, finalUrl, redirected, httpStatus, body, pageTitle }) {
  if (httpStatus < 200 || httpStatus >= 300 || !body) {
    return null;
  }

  const searchable = searchablePageText(body, pageTitle);
  const captchaMarker = findMarker(searchable, CAPTCHA_MARKERS);
  if (captchaMarker) {
    return { status: 'unknown', reason: `html-captcha-${slugifyMarker(captchaMarker)}` };
  }

  const removedMarker = findMarker(searchable, REMOVED_MARKERS);
  if (removedMarker) {
    return { status: 'removed', reason: `html-removed-${slugifyMarker(removedMarker)}` };
  }

  const originalTokens = extractMeaningfulPathTokens(profileUrl);
  const finalTokens = extractMeaningfulPathTokens(finalUrl);
  const sharedTokenCount = countSharedTokens(originalTokens, finalTokens);
  const profileMarker = findMarker(searchable, PROFILE_MARKERS);

  if (redirected) {
    const genericMarker = findMarker(searchable, GENERIC_LANDING_MARKERS);
    if (genericMarker && sharedTokenCount === 0) {
      return { status: 'removed', reason: `redirected-to-generic-landing-${slugifyMarker(genericMarker)}` };
    }

    const enoughSharedTokens = sharedTokenCount >= Math.min(2, originalTokens.length || 2);
    if (enoughSharedTokens || (sharedTokenCount >= 1 && profileMarker)) {
      return { status: 'still-present', reason: 'redirected-to-canonical-profile' };
    }
  }

  if (!redirected && profileMarker) {
    return { status: 'still-present', reason: `html-profile-marker-${slugifyMarker(profileMarker)}` };
  }

  return null;
}

function searchablePageText(body, pageTitle) {
  const stripped = String(body || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return `${String(pageTitle || '').toLowerCase()} ${stripped}`.trim();
}

function extractTitle(body) {
  const match = String(body || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, ' ').trim().slice(0, 300) || null;
}

function findMarker(text, markers) {
  const haystack = String(text || '').toLowerCase();
  return markers.find(marker => haystack.includes(marker)) || null;
}

function slugifyMarker(marker) {
  return String(marker).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractMeaningfulPathTokens(value) {
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return [...new Set(
      pathname
        .split(/[^a-z0-9]+/)
        .filter(token =>
          token.length >= 4
          && !/^\d+$/.test(token)
          && !PATH_TOKEN_STOP_WORDS.has(token)
        )
    )];
  } catch {
    return [];
  }
}

function countSharedTokens(left, right) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return left.filter(token => rightSet.has(token)).length;
}
