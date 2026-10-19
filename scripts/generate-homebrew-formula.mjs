#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFormula } from './formula.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = process.argv[2] ?? pkg.version;
const target = path.resolve(process.argv[3] ?? path.join(root, 'dist/Formula/cleanary.rb'));
const tarball = `https://registry.npmjs.org/cleanary/-/cleanary-${version}.tgz`;

async function downloadTarball() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(tarball);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 5) throw new Error(`could not download npm package: HTTP ${response.status} from ${tarball}`);
    await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
  }
  throw new Error('unreachable');
}

const tgz = await downloadTarball();
const sha256 = createHash('sha256').update(tgz).digest('hex');
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, renderFormula(version, sha256), { mode: 0o600, flag: 'w' });
console.log(`Generated ${target}\nTarball SHA-256: ${sha256}`);
