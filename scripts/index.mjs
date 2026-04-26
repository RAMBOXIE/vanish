#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BINARY_ALIASES,
  commandsForTier,
  COMMAND_MANIFEST,
  EVIDENCE_METADATA,
  SUBCOMMANDS,
  TIER_METADATA,
  TIER_ORDER
} from '../src/command-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function renderTierSection(tier, width) {
  const tierMeta = TIER_METADATA[tier];
  const lines = [`${tierMeta.heading} (${tierMeta.description})`];

  for (const command of commandsForTier(tier)) {
    lines.push(`  ${command.id.padEnd(width)} [${command.evidence}] ${command.description}`);
    lines.push(`    Example: ${command.example}`);
  }

  return lines;
}

function renderHelp() {
  const width = Math.max(...COMMAND_MANIFEST.map(({ id }) => id.length));
  const aliasLine = BINARY_ALIASES
    .map(({ binary, command }) => `${binary} -> vanish ${command}`)
    .join(', ');

  const lines = [
    'Vanish - privacy scanner + opt-out orchestrator for 210 data brokers',
    '',
    'Usage:',
    '  vanish <command> [options]',
    '  vanish help',
    '',
    'Command tiers:',
    ...TIER_ORDER.map((tier) => `  ${TIER_METADATA[tier].heading} - ${TIER_METADATA[tier].description}`),
    '',
    'Evidence legend:',
    ...Object.entries(EVIDENCE_METADATA).map(([grade, description]) => `  ${grade} - ${description}`),
    '',
    'Commands:',
    ''
  ];

  for (const tier of TIER_ORDER) {
    lines.push(...renderTierSection(tier, width));
    lines.push('');
  }

  lines.push(`Alias: ${aliasLine}`);
  lines.push('');
  lines.push('Quick start:');
  lines.push('  vanish scan --name "Your Name" --email "you@example.com"');
  lines.push('');
  lines.push('Docs: https://github.com/RAMBOXIE/vanish');
  lines.push('');

  return lines.join('\n');
}

const HELP = renderHelp();

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (!subcommand || subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const script = SUBCOMMANDS[subcommand];
  if (!script) {
    process.stderr.write(`Unknown command: ${subcommand}\n`);
    process.stderr.write(HELP);
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, script);
  const child = spawn(process.execPath, [scriptPath, ...rest], {
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    process.stderr.write(`Failed to run ${subcommand}: ${err.message}\n`);
    process.exit(1);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}

export { HELP, renderHelp, SUBCOMMANDS };
