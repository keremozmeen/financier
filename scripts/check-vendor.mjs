#!/usr/bin/env node
// Fails when a vendored tarball does not match the checksum recorded in DECISIONS.md (D18).
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** SHA-256 of each file in vendor/, as downloaded once from the publisher's official site. */
export const VENDOR_CHECKSUMS = {
  // https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  'vendor/xlsx-0.20.3.tgz': '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8',
};

const problems = [];
for (const [path, expected] of Object.entries(VENDOR_CHECKSUMS)) {
  const actual = createHash('sha256')
    .update(await readFile(root + path))
    .digest('hex');
  if (actual !== expected) problems.push(`${path}: expected ${expected}, got ${actual}`);
}

if (problems.length > 0) {
  console.error('Vendor checksum check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Vendor checksums match.');
