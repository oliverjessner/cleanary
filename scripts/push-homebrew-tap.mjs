#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint = 'https://api.github.com/repos/oliverjessner/homebrew-tap/contents/Formula/cleanary.rb';

export async function pushFormula({ token, version, contents, fetchImpl = fetch }) {
  if (!token) throw new Error('HOMEBREW_TAP_TOKEN is required');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cleanary-release',
  };
  const existing = await fetchImpl(`${endpoint}?ref=main`, { headers });
  if (!existing.ok && existing.status !== 404) throw new Error(`GitHub read failed: HTTP ${existing.status}`);
  const current = existing.ok ? await existing.json() : undefined;
  const content = Buffer.from(contents).toString('base64');
  if (current?.content?.replace(/\s/g, '') === content) return false;

  const result = await fetchImpl(endpoint, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore(cleanary): update Homebrew formula to ${version}`,
      branch: 'main',
      content,
      ...(current ? { sha: current.sha } : {}),
    }),
  });
  if (!result.ok) throw new Error(`GitHub Homebrew tap update failed: HTTP ${result.status}`);
  return true;
}

if (import.meta.main) {
  const token = process.env.HOMEBREW_TAP_TOKEN;
  if (!token) throw new Error('HOMEBREW_TAP_TOKEN is required');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const file = process.argv[2] ?? path.join(root, 'dist/Formula/cleanary.rb');
  const contents = await readFile(file);
  const updated = await pushFormula({ token, version: pkg.version, contents });
  console.log(`${updated ? 'Updated' : 'Already up to date:'} Formula/cleanary.rb in oliverjessner/homebrew-tap for ${pkg.version}`);
}
