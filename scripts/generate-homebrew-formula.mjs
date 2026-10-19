#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFormula } from './formula.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function downloadTarball(tarball, {
  fetchImpl = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = new URL(tarball);
    // npm can cache a 404 before a newly published tarball becomes available.
    if (attempt > 0) url.searchParams.set('cleanary_retry', `${Date.now()}-${attempt}`);
    const response = await fetchImpl(url.href, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const retryable = response.status === 404 || response.status === 429 || response.status >= 500;
    if (attempt === 5 || !retryable) {
      throw new Error(`could not download npm package: HTTP ${response.status} from ${tarball}. The version must be published on npm first; if it was just published, retry shortly.`);
    }
    await wait((attempt + 1) * 1500);
  }
  throw new Error('unreachable');
}

export async function generateFormula(version, target = path.join(root, 'dist/Formula/cleanary.rb')) {
  const tarball = `https://registry.npmjs.org/cleanary/-/cleanary-${version}.tgz`;
  const tgz = await downloadTarball(tarball);
  const sha256 = createHash('sha256').update(tgz).digest('hex');
  const contents = renderFormula(version, sha256);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, { mode: 0o644, flag: 'w' });
  await chmod(target, 0o644);
  console.log(`Generated ${target}\nTarball SHA-256: ${sha256}`);
  return contents;
}

if (import.meta.main) {
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const version = process.argv[2] ?? pkg.version;
    const target = path.resolve(process.argv[3] ?? path.join(root, 'dist/Formula/cleanary.rb'));
    await generateFormula(version, target);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}
