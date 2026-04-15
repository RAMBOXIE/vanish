#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultStore } from '../src/queue/state-store.mjs';

export function buildDashboardData({ statePath = path.resolve('data/queue-state.json'), dataDir = path.resolve('dashboard', 'data') } = {}) {
  const resolvedStatePath = path.resolve(statePath);
  const store = createDefaultStore({ filePath: resolvedStatePath });
  const state = store.read();

  fs.mkdirSync(dataDir, { recursive: true });

  const status = {
    generatedAt: new Date().toISOString(),
    mode: 'live-aware',
    counters: {
      pendingRetry: state.retry.filter(item => item.status === 'queued').length,
      manualReview: state.manualReview.filter(item => item.status === 'open').length,
      deadLetter: state.deadLetter.filter(item => item.status === 'open').length,
      completed: state.completed.length,
      failed: state.failed.length
    }
  };

  fs.writeFileSync(path.join(dataDir, 'retry-queue.json'), JSON.stringify(state.retry, null, 2));
  fs.writeFileSync(path.join(dataDir, 'manual-review-queue.json'), JSON.stringify(state.manualReview, null, 2));
  fs.writeFileSync(path.join(dataDir, 'dead-letter-queue.json'), JSON.stringify(state.deadLetter, null, 2));
  fs.writeFileSync(path.join(dataDir, 'completed.json'), JSON.stringify(state.completed, null, 2));
  fs.writeFileSync(path.join(dataDir, 'failed.json'), JSON.stringify(state.failed, null, 2));
  fs.writeFileSync(path.join(dataDir, 'status.json'), JSON.stringify(status, null, 2));

  return { statePath: resolvedStatePath, dataDir };
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  const result = buildDashboardData({ statePath: process.argv[2] || 'data/queue-state.json' });
  process.stdout.write(`Wrote dashboard data from ${result.statePath} to ${result.dataDir}\n`);
}
