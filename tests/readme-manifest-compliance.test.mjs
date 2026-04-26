import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMAND_MANIFEST,
  COMMAND_MANIFEST_BY_ID
} from '../src/command-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const README_PATH = path.resolve(__dirname, '..', 'README.md');

// Map: README H3 heading text -> manifest tier id.
// If you rename a heading in README, update this table.
const TIER_BY_HEADING = {
  'Core (stable, in hero)': 'core',
  'Specialist (stable, narrower scope)': 'specialist',
  'Labs / Research (not core promises)': 'labs'
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract `{ id, evidence, tier }` rows from each tier table in the README.
// Looks for `### <Heading>` then the first markdown table that follows.
function extractMatrixRows(readmeText) {
  const rows = [];

  for (const [heading, tier] of Object.entries(TIER_BY_HEADING)) {
    const headingPattern = new RegExp(`^### ${escapeRegExp(heading)}\\s*$`, 'm');
    const headingMatch = readmeText.match(headingPattern);
    assert.ok(headingMatch, `README is missing tier heading: ### ${heading}`);

    const tail = readmeText.slice(headingMatch.index + headingMatch[0].length);
    const lines = tail.split('\n');

    let separatorPassed = false;
    let tableStarted = false;

    for (const line of lines) {
      if (!line.startsWith('|')) {
        if (tableStarted) break;
        continue;
      }
      tableStarted = true;
      if (/^\|[\s\-:|]+\|/.test(line)) {
        separatorPassed = true;
        continue;
      }
      if (!separatorPassed) continue;

      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      const idMatch = cells[0]?.match(/^`([^`]+)`$/);
      if (!idMatch) continue;

      rows.push({
        id: idMatch[1],
        evidence: cells[3] || '',
        tier
      });
    }
  }

  return rows;
}

test('every README capability matrix row matches the manifest', () => {
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const rows = extractMatrixRows(readme);

  assert.ok(rows.length > 0, 'no rows extracted from README capability matrix');

  for (const row of rows) {
    const manifest = COMMAND_MANIFEST_BY_ID[row.id];
    assert.ok(
      manifest,
      `README references unknown command: ${row.id}`
    );

    assert.equal(
      manifest.tier,
      row.tier,
      `${row.id}: README places it under ${row.tier} but manifest says ${manifest.tier}`
    );

    const firstLetter = row.evidence.match(/[A-D]/)?.[0];
    assert.ok(
      firstLetter,
      `${row.id}: README evidence cell "${row.evidence}" has no A-D grade`
    );
    assert.equal(
      firstLetter,
      manifest.evidence,
      `${row.id}: README evidence "${row.evidence}" (first grade ${firstLetter}) `
        + `does not match manifest "${manifest.evidence}"`
    );
  }
});

test('every non-internal manifest command appears in README capability matrix', () => {
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const rows = extractMatrixRows(readme);
  const idsInReadme = new Set(rows.map((row) => row.id));

  for (const command of COMMAND_MANIFEST) {
    if (command.tier === 'internal') continue;
    assert.ok(
      idsInReadme.has(command.id),
      `manifest command ${command.id} (tier ${command.tier}) is missing from README capability matrix`
    );
  }
});
