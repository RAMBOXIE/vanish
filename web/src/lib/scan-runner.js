// Browser-side adapter around the shared scanner modules.
// Imports are resolved via Vite aliases (see vite.config.js).

import { runHeuristicScan } from '@scanner/scan-engine.mjs';
import { renderShareCardSvg, renderTripleThreatCardSvg } from '@scanner/share-card.mjs';
import brokerCatalog from '@catalog';

import { runAiScan, buildUsageFromFlags } from '@ai-scanner/ai-scan-engine.mjs';
import aiCatalog from '@ai-catalog';

import faceCatalog from '@face-catalog';

// ─── Broker scan ────────────────────────────────────────────────

export function runScan(identity) {
  return runHeuristicScan(identity, { catalog: brokerCatalog });
}

export function buildShareCardSvg(scanResult) {
  return renderShareCardSvg(scanResult);
}

export function buildTripleThreatCardSvg(scores) {
  return renderTripleThreatCardSvg(scores);
}

export function getCatalog() {
  return brokerCatalog;
}

// ─── AI training exposure scan ──────────────────────────────────

export function runAiExposureScan(selectedPlatformFlags) {
  // selectedPlatformFlags is { chatgpt: true, linkedin: true, ... } — user's checkboxes
  const usage = buildUsageFromFlags(selectedPlatformFlags, aiCatalog);
  return runAiScan(usage, { catalog: aiCatalog });
}

export function runAiAllPlatformsScan() {
  // Worst-case: assume user uses everything
  const usage = Object.fromEntries(Object.keys(aiCatalog.platforms).map(k => [k, true]));
  return runAiScan(usage, { catalog: aiCatalog });
}

export function getAiCatalog() {
  return aiCatalog;
}

// ─── Face-search directory ──────────────────────────────────────

export function getFaceCatalog() {
  return faceCatalog;
}
