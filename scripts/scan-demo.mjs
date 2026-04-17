#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { runHeuristicScan } from '../src/scanner/scan-engine.mjs';
import { renderScanReport } from '../src/scanner/scan-report.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { out[key] = true; }
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  process.stdout.write(`
Usage: node scripts/scan-demo.mjs [options]

Options:
  --name "Full Name"       Person's full name (required)
  --email "email@addr"     Email address
  --phone "+15551234567"   Phone number
  --username "handle"      Username/social handle
  --jurisdiction "US"      Jurisdiction (default: US)
  --city "City"            City
  --state "State"          State/province
  --output-json path       Write JSON result to file
  --output-md path         Write Markdown report to file
  --json                   Output JSON to stdout instead of Markdown
  --help                   Show this help
`);
  process.exit(0);
}

if (!args.name) {
  process.stderr.write('Error: --name is required. Use --help for usage.\n');
  process.exit(1);
}

const identity = {
  fullName: args.name,
  emails: args.email ? [args.email] : [],
  phones: args.phone ? [args.phone] : [],
  usernames: args.username ? [args.username] : [],
  jurisdiction: args.jurisdiction || 'US',
  city: args.city || null,
  state: args.state || null
};

const result = runHeuristicScan(identity);

// Output
if (args['output-json']) {
  const outPath = path.resolve(args['output-json']);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
}

if (args['output-md']) {
  const outPath = path.resolve(args['output-md']);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderScanReport(result));
}

if (args.json) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  process.stdout.write(renderScanReport(result) + '\n');
}
