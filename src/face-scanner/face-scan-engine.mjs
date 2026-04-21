// Face-search service engine — directory-style (not heuristic scoring).
//
// Unlike ai-scan, we can't programmatically determine "where your face is"
// without uploading your photo to each service (which violates their ToS and
// would defeat the privacy-first premise). Instead, face-scan is a directory
// of services with per-service walkthroughs that the user runs themselves.
//
// Isomorphic: works in Node + browser.

/**
 * List services by filter criteria.
 */
export function listServices(catalog, filter = {}) {
  const entries = Object.entries(catalog.services);
  return entries
    .filter(([key, service]) => {
      if (filter.category && service.category !== filter.category) return false;
      if (filter.accessModel && service.accessModel !== filter.accessModel) return false;
      if (filter.hasScan && !service.scanWalkthrough) return false;
      if (filter.hasOptOut && !service.optOutWalkthrough) return false;
      return true;
    })
    .map(([key, service]) => ({ key, ...service }));
}

/**
 * Resolve user-given flags (e.g., "pimeyes", "facecheck") to catalog service keys.
 * Accepts signalAsked shortcuts OR full keys.
 */
export function resolveServiceKeys(flags, catalog) {
  const keys = [];
  const entries = Object.entries(catalog.services);

  if (flags.all) {
    for (const [key] of entries) keys.push(key);
    return keys;
  }

  if (flags.use) {
    const tokens = String(flags.use).split(',').map(s => s.trim()).filter(Boolean);
    for (const token of tokens) {
      const found = entries.find(([k, s]) => k === token || s.signalAsked === token);
      if (!found) continue; // caller warns
      if (!keys.includes(found[0])) keys.push(found[0]);
    }
  }

  for (const [key, service] of entries) {
    if (flags[key] || flags[service.signalAsked]) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  return keys;
}

/**
 * Plan a scan session — which services to check and in what order.
 * Prioritizes by: has scan walkthrough > free/freemium > comprehensive index.
 */
export function planFaceScan(serviceKeys, catalog) {
  const PRIORITY = { 'pimeyes': 1, 'facecheck-id': 2, 'findclone': 3, 'lenso': 4, 'yandex-images': 5, 'google-lens': 6, 'tineye': 7, 'clearview-ai': 99 };

  const plan = serviceKeys
    .map(key => ({ key, service: catalog.services[key] }))
    .filter(entry => entry.service && entry.service.scanWalkthrough)
    .sort((a, b) => (PRIORITY[a.key] ?? 50) - (PRIORITY[b.key] ?? 50));

  const unscannable = serviceKeys
    .map(key => ({ key, service: catalog.services[key] }))
    .filter(entry => entry.service && !entry.service.scanWalkthrough);

  return { plan, unscannable };
}

/**
 * Plan an opt-out session — which services accept opt-out requests.
 */
export function planFaceOptOut(serviceKeys, catalog) {
  const entries = serviceKeys
    .map(key => ({ key, service: catalog.services[key] }))
    .filter(entry => entry.service && entry.service.optOutWalkthrough);

  return entries;
}
