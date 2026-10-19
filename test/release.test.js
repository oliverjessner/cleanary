'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('Homebrew formula renders reproducibly with vetted sha256', async () => {
  const { renderFormula } = await import('../scripts/formula.mjs');
  const sha = 'a'.repeat(64);
  const formula = renderFormula('0.1.0', sha);
  assert.match(formula, /cleanary-0\.1\.0\.tgz/);
  assert.match(formula, /depends_on "node"/);
  assert.match(formula, /sha256 "a{64}"/);
  assert.match(formula, /std_npm_args/);
  assert.throws(() => renderFormula('anything', sha));
  assert.throws(() => renderFormula('0.1.0', 'abc'));
});

test('tarball download bypasses cached 404 responses without changing the formula URL', async () => {
  const { downloadTarball } = await import('../scripts/generate-homebrew-formula.mjs');
  const tarball = 'https://registry.npmjs.org/cleanary/-/cleanary-0.1.3.tgz';
  const requests = [];
  const waits = [];
  const bytes = await downloadTarball(tarball, {
    wait: async (ms) => waits.push(ms),
    fetchImpl: async (url, options) => {
      requests.push(url);
      assert.equal(options.headers['Cache-Control'], 'no-cache');
      return requests.length < 3 ? new Response(null, { status: 404 }) : new Response('package tarball');
    },
  });
  assert.equal(bytes.toString(), 'package tarball');
  assert.equal(requests[0], tarball);
  for (const request of requests.slice(1)) {
    const url = new URL(request);
    assert.equal(`${url.origin}${url.pathname}`, tarball);
    assert.ok(url.searchParams.has('cleanary_retry'));
  }
  assert.notEqual(requests[1], requests[2]);
  assert.deepEqual(waits, [1500, 3000]);
});

test('tarball download has bounded retries and fails immediately on denied access', async () => {
  const { downloadTarball } = await import('../scripts/generate-homebrew-formula.mjs');
  for (const status of [404, 429, 503, 403]) {
    let requests = 0;
    await assert.rejects(downloadTarball('https://registry.npmjs.org/cleanary/-/cleanary-0.1.3.tgz', {
      wait: async () => {},
      fetchImpl: async () => { requests++; return new Response(null, { status }); },
    }), new RegExp(`HTTP ${status}.*published on npm first`));
    assert.equal(requests, status === 403 ? 1 : 6);
  }
});

test('release validation rejects wrong tags, unstable versions and inconsistent lockfiles', async () => {
  const { validateRelease } = await import('../scripts/check-release.mjs');
  const pkg = { name: 'cleanary', version: '0.1.0' };
  const lock = { ...pkg, packages: { '': { ...pkg } } };
  assert.doesNotThrow(() => validateRelease('v0.1.0', pkg, lock));
  for (const tag of [undefined, '0.1.0', 'v0.2.0', 'v0.1.0\n']) {
    assert.throws(() => validateRelease(tag, pkg, lock), /release tag/);
  }
  for (const version of ['0.1.0-beta.1', '0.1.0+build', '01.1.0', 'invalid']) {
    assert.throws(() => validateRelease(`v${version}`, { ...pkg, version }, lock), /stable/);
  }
  assert.throws(() => validateRelease('v0.1.0', pkg, { ...lock, version: '0.0.1' }), /versions must match/);
  assert.throws(() => validateRelease('v0.1.0', pkg, {
    ...lock, packages: { '': { ...pkg, version: '0.0.1' } },
  }), /versions must match/);
  assert.throws(() => validateRelease('v0.1.0', { ...pkg, name: 'other' }, lock), /describe cleanary/);
});

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tapFixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanary-tap-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const remote = path.join(folder, 'remote.git');
  const seed = path.join(folder, 'seed');
  const tapDir = path.join(folder, 'tap');
  git(folder, 'init', '--bare', '--initial-branch=main', remote);
  git(folder, 'init', '--initial-branch=main', seed);
  for (const [key, value] of [['user.name', 'Cleanary Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false']]) {
    git(seed, 'config', key, value);
  }
  fs.writeFileSync(path.join(seed, 'README.md'), 'Original tap\n');
  git(seed, 'add', 'README.md');
  git(seed, 'commit', '-m', 'Initial tap');
  git(seed, 'remote', 'add', 'origin', remote);
  git(seed, 'push', '-u', 'origin', 'main');
  git(folder, 'clone', remote, tapDir);
  for (const [key, value] of [['user.name', 'Cleanary Test'], ['user.email', 'test@example.invalid'], ['commit.gpgsign', 'false']]) {
    git(tapDir, 'config', key, value);
  }
  return { tapDir, seed, remote };
}

test('local Homebrew publication fast-forwards, commits only the formula and pushes it', async (t) => {
  const { pushFormula } = await import('../scripts/push-homebrew-tap.mjs');
  const { renderFormula } = await import('../scripts/formula.mjs');
  const { tapDir, seed, remote } = tapFixture(t);
  fs.writeFileSync(path.join(seed, 'README.md'), 'Upstream update\n');
  git(seed, 'add', 'README.md');
  git(seed, 'commit', '-m', 'Upstream change');
  git(seed, 'push', 'origin', 'main');
  const contents = renderFormula('0.1.1', 'a'.repeat(64));
  assert.equal(await pushFormula({ tapDir, version: '0.1.1', contents }), true);
  assert.equal(git(remote, 'show', 'main:Formula/cleanary.rb'), contents.trim());
  assert.equal(git(tapDir, 'show', '--format=', '--name-only', 'HEAD'), 'Formula/cleanary.rb');
  assert.equal(git(tapDir, 'show', '-s', '--format=%s'), 'chore(cleanary): update Homebrew formula to 0.1.1');
  assert.equal(fs.readFileSync(path.join(tapDir, 'README.md'), 'utf8'), 'Upstream update\n');
  assert.equal(git(tapDir, 'status', '--porcelain'), '');
  const firstCommit = git(remote, 'rev-parse', 'main');
  assert.equal(await pushFormula({ tapDir, version: '0.1.1', contents }), false);
  assert.equal(git(remote, 'rev-parse', 'main'), firstCommit);

  const nextContents = renderFormula('0.1.2', 'b'.repeat(64));
  assert.equal(await pushFormula({ tapDir, version: '0.1.2', contents: nextContents }), true);
  assert.equal(git(remote, 'show', 'main:Formula/cleanary.rb'), nextContents.trim());
});

test('local publication preserves untracked, staged and unpushed work and refuses other branches', async (t) => {
  const { pushFormula } = await import('../scripts/push-homebrew-tap.mjs');
  const { tapDir, remote } = tapFixture(t);
  const originalCommit = git(remote, 'rev-parse', 'main');
  const options = { tapDir, version: '0.1.1', contents: 'new formula\n' };
  const notes = path.join(tapDir, 'notes.txt');
  fs.writeFileSync(notes, 'User work\n');
  await assert.rejects(pushFormula(options), /local changes/);
  assert.equal(fs.readFileSync(notes, 'utf8'), 'User work\n');
  fs.rmSync(notes);

  git(tapDir, 'switch', '-c', 'work');
  await assert.rejects(pushFormula(options), /must be on main/);
  git(tapDir, 'switch', 'main');

  fs.writeFileSync(path.join(tapDir, 'README.md'), 'Staged user work\n');
  git(tapDir, 'add', 'README.md');
  await assert.rejects(pushFormula(options), /local changes/);
  assert.equal(git(tapDir, 'diff', '--cached', '--name-only'), 'README.md');
  git(tapDir, 'commit', '-m', 'Unpushed user work');
  await assert.rejects(pushFormula(options), /unpushed commits/);
  assert.equal(git(remote, 'rev-parse', 'main'), originalCommit);
  assert.equal(fs.existsSync(path.join(tapDir, 'Formula/cleanary.rb')), false);
});

test('local publication refuses a subdirectory of another Git checkout', async (t) => {
  const { pushFormula } = await import('../scripts/push-homebrew-tap.mjs');
  const { tapDir } = tapFixture(t);
  const nested = path.join(tapDir, 'nested');
  fs.mkdirSync(nested);
  await assert.rejects(pushFormula({ tapDir: nested, version: '0.1.1', contents: 'formula' }), /root of its own Git checkout/);
});
