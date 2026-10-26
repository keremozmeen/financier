#!/usr/bin/env node
// Fails the build if source code reaches for another origin or the CSP is weakened.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkIndexHtml, findRemoteCalls } from './zero-cloud.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_EXT = /\.(?:[cm]?[jt]sx?)$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (SOURCE_EXT.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name)) yield path;
  }
}

const problems = [];

for await (const file of walk(join(root, 'src'))) {
  for (const hit of findRemoteCalls(await readFile(file, 'utf8'))) {
    problems.push(`${relative(root, file)}:${hit.line} remote call: ${hit.snippet}`);
  }
}

for (const problem of checkIndexHtml(await readFile(join(root, 'index.html'), 'utf8'))) {
  problems.push(`index.html: ${problem}`);
}

if (problems.length > 0) {
  console.error('Zero-Cloud check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Zero-Cloud check passed.');
