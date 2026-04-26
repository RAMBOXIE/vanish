#!/usr/bin/env node

import path from 'node:path';
import { createDefaultStore } from '../src/queue/state-store.mjs';
import { resolveManualReview, retryFromQueue } from '../src/orchestrator/b1-runner.mjs';
import { kindOf, labelFor, isVerifiable } from '../src/verifier/followup-kinds.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      if (!out.command) out.command = token;
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

// ─── Table-rendering helpers ───────────────────────────────────

const ICON_BY_STATUS = {
  'verified-removed':         '✅',
  'still-present':            '❌',
  'pending-verification':     '⏳',
  'pending-email-verification': '📧',
  'pending-reverification':   '⏳',
  'pending-removal':          '⏳'
};

function renderFollowUpTable(followUp) {
  if (!followUp || followUp.length === 0) return '  (no follow-up entries)';

  const rows = followUp.map((e) => {
    const kind = kindOf(e);
    const label = labelFor(e);
    const status = e.status || 'pending';
    const icon = ICON_BY_STATUS[status] || '·';
    const submitted = (e.submittedAt || '').slice(0, 10) || '—';
    const recheck = (e.recheckAt || '').slice(0, 10) || '—';
    return [icon, kind, label, status, submitted, recheck];
  });

  const headers = ['', 'KIND', 'TARGET', 'STATUS', 'SUBMITTED', 'RECHECK'];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => String(r[i]).length))
  );
  const fmt = (row) => row.map((c, i) => String(c).padEnd(widths[i])).join('  ');

  const lines = [];
  lines.push('  ' + fmt(headers));
  lines.push('  ' + widths.map(w => '─'.repeat(w)).join('  '));
  for (const row of rows) lines.push('  ' + fmt(row));
  return lines.join('\n');
}

function renderQueueGroup(label, items) {
  const count = (items && items.length) || 0;
  if (count === 0) return null;
  return `  ${label}: ${count}`;
}

function renderListReport(state) {
  const lines = [];
  lines.push('');
  lines.push('━━━ Vanish queue state ━━━');
  lines.push('');

  // Follow-up table is the primary view (most user-relevant)
  const followUp = state.followUp || [];
  lines.push(`Follow-up entries (${followUp.length}):`);
  lines.push(renderFollowUpTable(followUp));
  lines.push('');

  // Audit summary (count + most recent timestamp)
  const audit = state.audit || [];
  if (audit.length > 0) {
    const last = audit[audit.length - 1];
    const lastAt = (last.at || '').slice(0, 19).replace('T', ' ');
    lines.push(`Audit log: ${audit.length} signed event(s)${lastAt ? ` (most recent: ${lastAt})` : ''}`);
    lines.push('');
  }

  // Other queues — only show if non-empty
  const groups = [
    renderQueueGroup('Retry queue (transient errors)', state.retry),
    renderQueueGroup('Manual-review queue (captcha / auth)', state.manualReview),
    renderQueueGroup('Dead-letter queue (permanent errors)', state.deadLetter),
    renderQueueGroup('Completed', state.completed),
    renderQueueGroup('Failed', state.failed)
  ].filter(Boolean);
  if (groups.length > 0) {
    lines.push('Other queues:');
    lines.push(...groups);
    lines.push('');
  }

  // Action hints
  const dueCount = followUp.filter(e => isVerifiable(e) && e.recheckAt && new Date(e.recheckAt) <= new Date()).length;
  if (dueCount > 0) {
    lines.push(`💡 ${dueCount} entr${dueCount === 1 ? 'y is' : 'ies are'} due for re-verification — run \`vanish verify\``);
  }
  if ((state.manualReview || []).length > 0) {
    lines.push(`💡 ${state.manualReview.length} item(s) in manual review — run \`vanish queue resolve --id <id>\``);
  }
  if ((state.retry || []).length > 0) {
    lines.push(`💡 ${state.retry.length} retry-queued — run \`vanish queue retry --id <id>\``);
  }

  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const store = createDefaultStore({ filePath: path.resolve(args['state-file'] || 'data/queue-state.json') });

if (args.command === 'list') {
  if (args.json) {
    // Preserve original behavior for scripting / piping
    process.stdout.write(`${JSON.stringify(store.read(), null, 2)}\n`);
    process.exit(0);
  }
  process.stdout.write(renderListReport(store.read()) + '\n');
  process.exit(0);
}

if (args.command === 'retry') {
  if (!args.id) {
    process.stderr.write('--id is required for retry\n');
    process.exit(1);
  }
  const result = await retryFromQueue({
    store,
    id: args.id,
    live: args.live !== 'false',
    authInput: {
      authToken: args['auth-token'],
      authCookie: args['auth-cookie'],
      authScopes: args['auth-scopes'],
      authExpiresAt: args['auth-expires-at']
    }
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.status === 'not_found' ? 1 : 0);
}

if (args.command === 'resolve') {
  if (!args.id) {
    process.stderr.write('--id is required for resolve\n');
    process.exit(1);
  }
  const result = await resolveManualReview({ store, id: args.id, resolution: args.resolution || 'resolved' });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.status === 'not_found' ? 1 : 0);
}

process.stderr.write('Usage: queue-cli.mjs list|retry|resolve [--id ...]\n');
process.exit(1);
