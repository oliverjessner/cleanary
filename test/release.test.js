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
