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

test('Homebrew update creates or updates only the formula on main with the matching file SHA', async () => {
  const { pushFormula } = await import('../scripts/push-homebrew-tap.mjs');
  const { renderFormula } = await import('../scripts/formula.mjs');
  const contents = renderFormula('0.1.0', 'a'.repeat(64));
  const endpoint = 'https://api.github.com/repos/oliverjessner/homebrew-tap/contents/Formula/cleanary.rb';
  for (const exists of [false, true]) {
    const requests = [];
    const updated = await pushFormula({
      token: 'test-token', version: '0.1.0', contents: Buffer.from(contents),
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        if (requests.length === 1) {
          return exists
            ? Response.json({ sha: 'existing-sha', content: Buffer.from('old formula').toString('base64') })
            : new Response(null, { status: 404 });
        }
        return Response.json({}, { status: exists ? 200 : 201 });
      },
    });
    assert.equal(updated, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, `${endpoint}?ref=main`);
    assert.equal(requests[1].url, endpoint);
    assert.equal(requests[1].options.method, 'PUT');
    assert.equal(requests[1].options.headers.Authorization, 'Bearer test-token');
    const body = JSON.parse(requests[1].options.body);
    assert.equal(body.branch, 'main');
    assert.equal(body.sha, exists ? 'existing-sha' : undefined);
    assert.equal(body.message, 'chore(cleanary): update Homebrew formula to 0.1.0');
    assert.equal(Buffer.from(body.content, 'base64').toString('utf8'), contents);
  }
});

test('repeating a Homebrew update does not create another commit', async () => {
  const { pushFormula } = await import('../scripts/push-homebrew-tap.mjs');
  let calls = 0;
  const updated = await pushFormula({
    token: 'test-token', version: '0.1.0', contents: Buffer.from('same formula'),
    fetchImpl: async () => {
      calls++;
      assert.equal(calls, 1, 'unchanged formula must not trigger a write');
      return Response.json({ sha: 'existing-sha', content: 'c2FtZSBm\nb3JtdWxh\n' });
    },
  });
  assert.equal(updated, false);
  assert.equal(calls, 1);
});

test('Homebrew update fails on missing credentials, denied reads and conflicting writes', async () => {
  const { pushFormula } = await import('../scripts/push-homebrew-tap.mjs');
  const options = { token: 'test-token', version: '0.1.0', contents: Buffer.from('formula') };
  await assert.rejects(pushFormula({
    ...options, token: '', fetchImpl: async () => assert.fail('missing credentials must not make requests'),
  }), /HOMEBREW_TAP_TOKEN is required/);
  await assert.rejects(pushFormula({
    ...options, fetchImpl: async () => new Response(null, { status: 403 }),
  }), /GitHub read failed: HTTP 403/);
  let calls = 0;
  await assert.rejects(pushFormula({
    ...options,
    fetchImpl: async () => {
      calls++;
      return calls === 1 ? Response.json({ sha: 'old-sha' }) : new Response(null, { status: 409 });
    },
  }), /GitHub Homebrew tap update failed: HTTP 409/);
  assert.equal(calls, 2);
});
