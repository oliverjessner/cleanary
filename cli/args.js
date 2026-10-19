'use strict';

class CliArgumentError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliArgumentError';
  }
}

const COMMANDS = new Set(['analyse', 'analyze', 'clean', 'duplicates', 'replace']);
const FLAGS = new Set(['help', 'version', 'ignore-case', 'case-sensitive', 'trim', 'json', 'counts', 'stdout', 'verbose', 'check', 'no-color']);
const VALUES = new Set(['mode', 'filepath', 'output', 'top', 'max-bytes']);
const SHORT = new Map([['-h','--help'], ['-v','--version'], ['-o','--filepath']]);

function parseArgs(argv) {
  const opts = { command: 'analyse', input: undefined, caseSensitive: true, trim: false, top: 10, maxBytes: 128 * 1024 * 1024 };
  const positionals = [];
  const used = new Set();
  for (let index = 0; index < argv.length; index++) {
    let arg = SHORT.get(argv[index]) ?? argv[index];
    if (arg === '--') { positionals.push(...argv.slice(index + 1)); break; }
    if (!arg.startsWith('--')) { positionals.push(arg); continue; }
    const split = arg.indexOf('=');
    const key = arg.slice(2, split < 0 ? undefined : split);
    if (!FLAGS.has(key) && !VALUES.has(key)) throw new CliArgumentError(`unknown option --${key}`);
    if (used.has(key)) throw new CliArgumentError(`--${key} can only be specified once`);
    used.add(key);
    if (FLAGS.has(key)) {
      if (split !== -1) throw new CliArgumentError(`--${key} does not take a value`);
      opts[key] = true;
    } else {
      const value = split < 0 ? argv[++index] : arg.slice(split + 1);
      if (value === undefined || !value.length || value.startsWith('--')) {
        throw new CliArgumentError(`--${key} requires a value`);
      }
      opts[key] = value;
    }
  }
  if (used.has('ignore-case') && used.has('case-sensitive')) throw new CliArgumentError('--ignore-case conflicts with --case-sensitive');
  if (used.has('ignore-case')) opts.caseSensitive = false;
  if (positionals[0] && COMMANDS.has(positionals[0])) {
    opts.command = positionals.shift();
    if (opts.command === 'analyze') opts.command = 'analyse';
  }
  if (opts.command === 'replace') {
    if (!opts.help && !opts.version && positionals.length < 2) {
      throw new CliArgumentError('usage: cleanary replace <file|-> <search> [replacement] [options]');
    }
    if (positionals.length > 3) throw new CliArgumentError('replace expects an input file, search text and optional replacement text');
    [opts.input, opts.search, opts.replacement = ''] = positionals;
    if (opts.search !== undefined && (!opts.search.length || /[\r\n]/.test(opts.search))) {
      throw new CliArgumentError('search must be a non-empty single-line string');
    }
    if (/[\r\n]/.test(opts.replacement)) throw new CliArgumentError('replacement must be a single-line string');
    if (opts.trim) throw new CliArgumentError('--trim is not supported for replace');
  } else {
    if (positionals.length > 1) throw new CliArgumentError('expected zero or one input file');
    opts.input = positionals[0];
  }
  if (used.has('output') && used.has('filepath')) throw new CliArgumentError('--output conflicts with --filepath');
  opts.filepath = opts.filepath ?? opts.output;
  if (opts.stdout && opts.filepath) throw new CliArgumentError('--stdout conflicts with --filepath');
  if (used.has('mode') && opts.command !== 'clean') throw new CliArgumentError('--mode is only supported for clean');
  if (opts.mode && !['dedupe', 'unique'].includes(opts.mode)) throw new CliArgumentError('--mode must be dedupe or unique');
  opts.mode ??= 'dedupe';
  if (opts.counts && opts.command !== 'duplicates') throw new CliArgumentError('--counts is only supported for duplicates');
  if (opts.check && opts.command !== 'analyse') throw new CliArgumentError('--check is only supported for analyse');
  if (opts.json && ['clean', 'replace'].includes(opts.command)) throw new CliArgumentError(`--json is not supported for ${opts.command}; its output is plain text`);
  if (opts.json && opts.counts) throw new CliArgumentError('--json conflicts with --counts');
  if (used.has('top') && opts.command !== 'analyse') throw new CliArgumentError('--top is only supported for analyse');
  if (used.has('top')) {
    const number = Number(opts.top);
    if (!Number.isSafeInteger(number) || number < 0) throw new CliArgumentError('--top must be a non-negative integer');
    opts.top = number;
  }
  if (used.has('max-bytes')) {
    const bytes = Number(opts['max-bytes']);
    if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new CliArgumentError('--max-bytes must be a positive integer');
    opts.maxBytes = bytes;
  }
  return opts;
}
module.exports = { parseArgs, CliArgumentError };
