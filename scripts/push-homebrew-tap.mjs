#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const formulaPath = 'Formula/cleanary.rb';

export async function pushFormula({ tapDir, version, contents }) {
  const cwd = await realpath(tapDir);
  const git = (...args) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  if (await realpath(git('rev-parse', '--show-toplevel')) !== cwd) {
    throw new Error('Homebrew tap path must be the root of its own Git checkout');
  }
  if (git('branch', '--show-current') !== 'main') {
    throw new Error('Homebrew tap must be on main');
  }
  if (git('status', '--porcelain')) {
    throw new Error('Homebrew tap has local changes; commit or stash them before publishing');
  }

  git('fetch', 'origin', 'main');
  if (git('rev-list', '--count', 'origin/main..HEAD') !== '0') {
    throw new Error('Homebrew tap has unpushed commits; push or review them before publishing');
  }
  git('merge', '--ff-only', 'origin/main');

  const target = path.join(cwd, formulaPath);
  const current = await readFile(target, 'utf8').catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (current === contents) return false;

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, { mode: 0o644 });
  git('add', '--', formulaPath);
  git('commit', '--only', '-m', `chore(cleanary): update Homebrew formula to ${version}`, '--', formulaPath);
  try {
    git('-c', 'push.followTags=false', 'push', 'origin', 'HEAD:refs/heads/main');
  } catch (error) {
    throw new Error(`Formula committed locally but push failed. Retry with git -C ${cwd} push origin main`, { cause: error });
  }
  return true;
}

if (import.meta.main) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  execFileSync(process.execPath, [path.join(root, 'scripts/generate-homebrew-formula.mjs')], {
    cwd: root, stdio: 'inherit',
  });
  const contents = await readFile(path.join(root, 'dist/Formula/cleanary.rb'), 'utf8');
  const tapDir = path.resolve(root, '../homebrew-tap');
  const updated = await pushFormula({ tapDir, version: pkg.version, contents });
  console.log(`${updated ? 'Published' : 'Already up to date:'} Formula/cleanary.rb in ${tapDir} for ${pkg.version}`);
}
