#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

export function validateRelease(tag, pkg, lock) {
  if (pkg.name !== 'cleanary' || lock.name !== pkg.name || lock.packages?.['']?.name !== pkg.name) {
    throw new Error('package.json and package-lock.json must both describe cleanary');
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version)) {
    throw new Error('releases require a stable X.Y.Z package version');
  }
  if (tag !== `v${pkg.version}`) {
    throw new Error(`release tag must be v${pkg.version}`);
  }
  if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) {
    throw new Error('package-lock.json versions must match package.json');
  }
}

if (import.meta.main) {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  validateRelease(process.argv[2], pkg, lock);
  console.log(`Validated release v${pkg.version}`);
}
