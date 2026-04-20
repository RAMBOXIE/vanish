#!/usr/bin/env node

import { runVanish } from '../src/vanish-cli.mjs';

const result = runVanish(process.argv.slice(2));

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status);
