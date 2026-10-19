'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { version } = require('../package.json');
const CLI = path.resolve(__dirname, '../cli/index.js');

function run(args = [], input = '') {
  return spawnSync(process.execPath, [CLI, ...args], { input, encoding: 'utf8', timeout: 5000 });
}

test('CLI version and help', () => {
  assert.equal(run(['--version']).stdout.trim(), version);
  assert.match(run(['--help']).stdout, /Cleanary .*Keep only what matters/);
});

test('stdin: analyze count, check exit code, JSON report', () => {
  const result = run(['analyse', '--json', '--check'], 'A\na\na\n');
  assert.equal(result.status, 3);
  assert.equal(JSON.parse(result.stdout).extraOccurrences, 1);
  assert.equal(JSON.parse(result.stdout).duplicateGroups, 1);
  assert.equal(run(['analyse', '--check'], 'a\nb\n').status, 0);
});

test('piped stdin: clean dedupe and unique modes', () => {
  const raw = 'A\na\nb\n';
  assert.equal(run(['clean', '--ignore-case'], raw).stdout, 'A\nb\n');
  assert.equal(run(['clean', '--mode', 'unique', '--ignore-case'], raw).stdout, 'b\n');
  assert.equal(run(['clean', '--mode=dedupe', '-'], raw).stdout, raw);
});

test('duplicates command prints repeated rows and optional counts', () => {
  assert.equal(run(['duplicates'], 'x\ny\ny\nx\nz\n').stdout, 'x\ny\n');
  assert.equal(run(['duplicates', '--counts'], 'x\nx\nx\n').stdout, '3\tx\n');
});

test('reads file and writes exclusive file without polluting stdout', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanary-test-'));
  try {
    const input = path.join(folder, 'in.txt');
    const output = path.join(folder, 'out.txt');
    fs.writeFileSync(input, 'aa\naa\nbb\n');
    const result = run(['clean', input, '--filepath', output]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(fs.readFileSync(output, 'utf8'), 'aa\nbb\n');
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    assert.equal(run(['clean', input, '-o', output]).status, 1);
    assert.equal(fs.readFileSync(output, 'utf8'), 'aa\nbb\n');
    const targetDir = path.join(folder, 'exports');
    assert.equal(run(['clean', input, '-o', targetDir]).status, 0);
    assert.equal(fs.readdirSync(targetDir).length, 1);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('rejects invalid options, invalid UTF-8 and too-large input', () => {
  assert.equal(run(['clean', '--mode', 'invalid'], 'a').status, 2);
  assert.equal(run(['clean', '--no-such-option'], 'a').status, 2);
  assert.equal(run(['clean', '--max-bytes', '2'], 'abc').status, 1);
  assert.equal(run(['clean', '--stdout', '--filepath', 'x.txt'], 'x').status, 2);
  const bad = spawnSync(process.execPath, [CLI, 'analyse'], { input: Buffer.from([0xff]), timeout: 5000 });
  assert.equal(bad.status, 2);
});

test('plain default reporting and no-color', () => {
  const output = run(['--no-color'], 'hello\nhello\nbye\n');
  assert.equal(output.status, 0);
  assert.match(output.stdout, /Duplicate groups\s+1/);
  assert.match(output.stdout, /Extra occurrences\s+1/);
  assert.equal(output.stderr, '');
});

test('replace removes or replaces literal text across all rows from stdin', () => {
  const input = 'FMA warnt vor Angeboten der Firma\nFMA warnt vor Angeboten der Firma\n';
  for (const replacement of [[], ['']]) {
    const result = run(['replace', '-', 'FMA warnt vor Angeboten der ', ...replacement], input);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'Firma\nFirma\n');
    assert.equal(result.stderr, '');
  }
  const result = run(['replace', '-', 'a.b', '$&', '--ignore-case', '--verbose'], 'A.B a.b aXb\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '$& $& aXb\n');
  assert.match(result.stderr, /Applied literal text replacement/);
  assert.equal(run(['replace', '--', '-', '-o', '--new'], '-o -o\n').stdout, '--new --new\n');
  assert.match(run(['replace', '--help']).stdout, /replace <file\|-> <search>/);
});

test('replace preserves BOM and exact line endings and enforces input validation', () => {
  const input = '\uFEFFx\r\n\nx\rx x\nx';
  const result = run(['replace', '-', 'x', 'y'], input);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '\uFEFFy\r\n\ny\ry y\ny');
  assert.equal(run(['clean', '-'], '\uFEFFa\r\na\r\n').stdout, '\uFEFFa\r\n');
  assert.equal(run(['replace', '-', 'x', '--max-bytes', '2'], 'xxx').status, 1);
  const bad = spawnSync(process.execPath, [CLI, 'replace', '-', 'x'], { input: Buffer.from([0xff]), timeout: 5000 });
  assert.equal(bad.status, 2);
});

test('replace supports file and directory output while refusing to overwrite any input or output', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanary-replace-'));
  try {
    const input = path.join(folder, 'headlines.txt');
    const output = path.join(folder, 'headlines-clean.txt');
    const source = 'FMA warnt vor Angeboten der Firma\r\n';
    fs.writeFileSync(input, source);
    const args = ['replace', input, 'FMA warnt vor Angeboten der ', '', '--filepath', output];
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assert.equal(fs.readFileSync(output, 'utf8'), 'Firma\r\n');
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
    assert.equal(run(args).status, 1);
    assert.equal(run(['replace', input, 'FMA', '-o', input]).status, 1);
    assert.equal(fs.readFileSync(input, 'utf8'), source);
    assert.equal(fs.readFileSync(output, 'utf8'), 'Firma\r\n');
    const directory = path.join(folder, 'exports');
    assert.equal(run(['replace', input, 'FMA', 'Authority', '--output', directory]).status, 0);
    const files = fs.readdirSync(directory);
    assert.equal(files.length, 1);
    assert.match(files[0], /^cleanary-replace-.*\.txt$/);
    assert.equal(fs.readFileSync(path.join(directory, files[0]), 'utf8'), 'Authority warnt vor Angeboten der Firma\r\n');
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

test('replace rejects missing or invalid text and incompatible command options', () => {
  const invalid = [
    ['replace'], ['replace', '-'], ['replace', '-', ''],
    ['replace', '-', 'x\ny'], ['replace', '-', 'x', '\r'],
    ['replace', '-', 'x', 'y', 'extra'],
    ...['--json', '--trim', '--counts', '--check'].map((flag) => ['replace', '-', 'x', flag]),
    ['replace', '-', 'x', '--mode', 'dedupe'],
    ['replace', '-', 'x', '--top', '1'],
    ['replace', '-', 'x', '--stdout', '-o', 'output.txt'],
  ];
  for (const args of invalid) {
    const result = run(args, 'x\n');
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stderr}`);
    assert.equal(result.stdout, '');
  }
});
