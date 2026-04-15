#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { buildDashboardData } from './build-dashboard-data.mjs';

const statePath = path.resolve(process.argv[2] || 'data/queue-state.json');
let timer = null;

function rebuild(reason) {
  try {
    const result = buildDashboardData({ statePath });
    process.stdout.write(`[dashboard-watch] ${reason}: Wrote dashboard data from ${result.statePath} to ${result.dataDir}\n`);
  } catch (error) {
    process.stderr.write(`[dashboard-watch] rebuild failed: ${error.message}\n`);
  }
}

function schedule(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => rebuild(reason), 100);
}

fs.mkdirSync(path.dirname(statePath), { recursive: true });
if (!fs.existsSync(statePath)) {
  fs.writeFileSync(statePath, JSON.stringify({ retry: [], manualReview: [], deadLetter: [], completed: [], failed: [], audit: [] }, null, 2));
}

rebuild('initial');
process.stdout.write(`[dashboard-watch] watching ${statePath}\n`);

const watcher = fs.watch(statePath, { persistent: true }, eventType => {
  schedule(eventType);
});

process.on('SIGINT', () => {
  watcher.close();
  process.stdout.write('[dashboard-watch] stopped\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  watcher.close();
  process.stdout.write('[dashboard-watch] stopped\n');
  process.exit(0);
});
