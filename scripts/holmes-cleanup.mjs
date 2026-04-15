#!/usr/bin/env node

import { runHolmesCleanup } from '../src/holmes-cleanup-cli.mjs';

const result = runHolmesCleanup(process.argv.slice(2));

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status);
