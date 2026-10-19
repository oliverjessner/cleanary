'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  analyseLines, analyzeLines, cleanLines, findDuplicates, analyseText,
  cleanText, findDuplicateText, makeNormalizer, CleanaryValidationError,
} = require('../src');

test('counts groups and duplicate occurrences separately', () => {
  const result = analyseLines(['a', 'b', 'a', 'a', 'c', 'b']);
  assert.deepEqual({ total: result.totalLines, distinct: result.distinctLines, groups: result.duplicateGroups,
    extras: result.extraOccurrences, repeated: result.repeatedRows, singletons: result.singletonRows },
  { total: 6, distinct: 3, groups: 2, extras: 3, repeated: 5, singletons: 1 });
  assert.deepEqual(result.duplicates, [
    { value: 'a', count: 3, firstLine: 1 },
    { value: 'b', count: 2, firstLine: 2 },
  ]);
  assert.deepEqual(analyzeLines([]).duplicates, []);
});

test('dedupe keeps first original row; unique drops every repeated group', () => {
  const rows = ['A', 'b', 'a', 'B', 'c', 'A'];
  assert.deepEqual(cleanLines(rows, { caseSensitive: false }), ['A', 'b', 'c']);
  assert.deepEqual(cleanLines(rows, { caseSensitive: false, mode: 'unique' }), ['c']);
  assert.deepEqual(rows, ['A', 'b', 'a', 'B', 'c', 'A']);
});

test('exact is default; trim and case-fold affect comparison only', () => {
  assert.equal(analyseText(' A\na\nA\n').duplicateGroups, 0);
  assert.equal(analyseText(' A\na\nA\n', { trim: true, caseSensitive: false }).extraOccurrences, 2);
  assert.equal(cleanText(' A\na\nA\n', { trim: true, caseSensitive: false }), ' A\n');
});

test('preserves BOM, first newline style, and trailing newline', () => {
  assert.equal(cleanText('\uFEFFdog\r\ncat\r\ndog\r\n'), '\uFEFFdog\r\ncat\r\n');
  assert.equal(cleanText('a\nb\na'), 'a\nb');
  assert.equal(cleanText('a\na\n', { mode: 'unique' }), '');
  assert.equal(cleanText(''), '');
  assert.equal(cleanText('\n\n', { mode: 'dedupe' }), '\n');
});

test('duplicate groups in descending frequency and stable first-seen order', () => {
  const groups = findDuplicateText('b\na\na\nb\n');
  assert.deepEqual(groups.map((x) => x.value), ['b', 'a']);
  assert.deepEqual(findDuplicates(['x', 'y', 'x']).map((x) => x.firstLine), [1]);
});

test('custom normalizers permit extension without touching the core', () => {
  const options = { normalize: (value) => value.replace(/\?.*$/, '') };
  assert.equal(makeNormalizer(options)('url?a=1'), 'url');
  assert.deepEqual(cleanLines(['url?a=1', 'url?a=2', 'another'], options), ['url?a=1', 'another']);
});

test('validates options, mode, input shape and custom normalizers', () => {
  assert.throws(() => cleanLines(['x'], { mode: 'delete-everything' }), CleanaryValidationError);
  assert.throws(() => analyseLines(['x', 2]), CleanaryValidationError);
  assert.throws(() => analyseText(null), CleanaryValidationError);
  assert.throws(() => makeNormalizer({ caseSensitive: 'false' }), CleanaryValidationError);
  assert.throws(() => analyseLines(['x'], { normalize: () => 2 }), CleanaryValidationError);
  assert.throws(() => analyseLines('bad iterable'), CleanaryValidationError);
});


test('ESM adapter exposes named and default exports', async () => {
  const module = await import('../src/index.mjs');
  assert.equal(module.cleanText('a\na\n'), 'a\n');
  assert.equal(typeof module.default.analyseLines, 'function');
});
