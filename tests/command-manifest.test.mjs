import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  COMMAND_MANIFEST,
  EVIDENCE_METADATA,
  PROMISE_TYPES,
  TIER_METADATA,
  TIER_ORDER
} from '../src/command-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'scripts', 'index.mjs');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('command manifest entries are unique and fully annotated', () => {
  const ids = new Set();
  const scripts = new Set(fs.readdirSync(SCRIPTS_DIR));
  const validTiers = new Set(TIER_ORDER);
  const validEvidence = new Set(Object.keys(EVIDENCE_METADATA));
  const validPromiseTypes = new Set(PROMISE_TYPES);

  for (const command of COMMAND_MANIFEST) {
    assert.ok(command.id, 'command id is required');
    assert.ok(!ids.has(command.id), `duplicate command id: ${command.id}`);
    ids.add(command.id);

    assert.ok(validTiers.has(command.tier), `invalid tier for ${command.id}: ${command.tier}`);
    assert.ok(validEvidence.has(command.evidence), `invalid evidence for ${command.id}: ${command.evidence}`);
    assert.ok(validPromiseTypes.has(command.promiseType), `invalid promise type for ${command.id}: ${command.promiseType}`);
    assert.match(command.description, /\S/, `${command.id} missing description`);
    assert.match(command.example, /\S/, `${command.id} missing example`);
    assert.ok(scripts.has(command.script), `${command.id} points to missing script ${command.script}`);
  }

  assert.equal(COMMAND_MANIFEST.length, 20, 'manifest should enumerate every routed subcommand');
});

test('command manifest has at least one command in every tier', () => {
  for (const tier of TIER_ORDER) {
    assert.ok(
      COMMAND_MANIFEST.some((command) => command.tier === tier),
      `tier ${tier} is empty`
    );
  }
});

test('CLI help is grouped by tier and prints evidence legend from manifest', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '--help'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);

  for (const tier of TIER_ORDER) {
    const header = `${TIER_METADATA[tier].heading} (${TIER_METADATA[tier].description})`;
    assert.match(result.stdout, new RegExp(escapeRegExp(header)));
  }

  for (const [grade, description] of Object.entries(EVIDENCE_METADATA)) {
    const line = `${grade} - ${description}`;
    assert.match(result.stdout, new RegExp(escapeRegExp(line)));
  }

  for (const command of COMMAND_MANIFEST) {
    assert.match(
      result.stdout,
      new RegExp(`\\b${escapeRegExp(command.id)}\\b\\s+\\[${command.evidence}\\]`),
      `help missing ${command.id}`
    );
  }
});
