#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.HOMEBREW_TAP_TOKEN;
if (!token) throw new Error('HOMEBREW_TAP_TOKEN is required');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const file = process.argv[2] ?? path.join(root, 'dist/Formula/cleanary.rb');
const contents = await readFile(file);
const endpoint = 'https://api.github.com/repos/oliverjessner/homebrew-tap/contents/Formula/cleanary.rb';
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'cleanary-release',
};
const existing = await fetch(endpoint, { headers });
if (!existing.ok && existing.status !== 404) throw new Error(`GitHub read failed: HTTP ${existing.status}`);
const sha = existing.ok ? (await existing.json()).sha : undefined;
const result = await fetch(endpoint, {
  method: 'PUT',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: `chore(cleanary): update Homebrew formula to ${pkg.version}`,
    branch: 'main',
    content: contents.toString('base64'),
    ...(sha ? { sha } : {}),
  }),
});
if (!result.ok) throw new Error(`GitHub Homebrew tap update failed: HTTP ${result.status}`);
console.log(`Updated Formula/cleanary.rb in oliverjessner/homebrew-tap for ${pkg.version}`);
