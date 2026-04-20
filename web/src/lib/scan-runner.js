// Browser-side adapter around the shared scanner modules.
// Imports are resolved via Vite aliases (see vite.config.js).

import { runHeuristicScan } from '@scanner/scan-engine.mjs';
import { renderShareCardSvg } from '@scanner/share-card.mjs';
import catalog from '@catalog';

export function runScan(identity) {
  return runHeuristicScan(identity, { catalog });
}

export function buildShareCardSvg(scanResult) {
  return renderShareCardSvg(scanResult);
}

// Re-exported so UI can show opt-out metadata per broker
export function getCatalog() {
  return catalog;
}
