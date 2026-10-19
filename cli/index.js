#!/usr/bin/env node
'use strict';
const pkg = require('../package.json');
const api = require('../src');
const { parseArgs, CliArgumentError } = require('./args');
const { readInput, resolveOutput, saveOutput } = require('./io');

const HELP = `Cleanary ${pkg.version} — Keep only what matters.

Usage: cleanary [analyse] [file|-] [options]
       cleanary clean [file|-] [--mode dedupe|unique] [options]
       cleanary duplicates [file|-] [--counts|--json] [options]
       cleanary replace <file|-> <search> [replacement] [options]

Commands:
  analyse       Count duplicates and show the most frequent rows (default)
  clean         Emit cleaned text, preserving the first occurrence by default
  duplicates    Emit each repeated value once, in frequency order
  replace       Replace all literal matches in each row (default replacement: empty)

Modes (clean only):
  dedupe        Remove extra copies, retain one row per value (default)
  unique        Remove ALL occurrences of repeated values, keep singletons

Options:
  --ignore-case                Match without case sensitivity
  --case-sensitive             Compare exactly (default)
  --trim                       Ignore leading/trailing spaces when comparing
  --mode dedupe|unique         Select clean mode
  --counts                     Print count and row, separated by a tab
  --json                       JSON output for analyse or duplicates
  --top <n>                    Max duplicate groups in human summary (default: 10)
  --check                      Exit 3 if any duplicates exist (analyse only)
  --filepath, --output, -o     Write to new file or output directory (no overwrite)
  --stdout                     Explicitly use stdout (the default)
  --max-bytes <n>              Maximum UTF-8 input bytes (default: 134217728)
  --verbose                    Write diagnostics to stderr
  --no-color                   Reserved for stable, colorless output
  --help, -h                   Show help
  --version, -v                Show version

Input defaults to stdin for analyse, clean and duplicates. For replace, use '-' for stdin.
Replacement uses literal single-line strings and preserves every row and line ending.
Duplicate matching preserves the original retained row contents.

Examples:
  cleanary analyse urls.txt
  cleanary analyse urls.txt --ignore-case --json
  cat urls.txt | cleanary clean --mode dedupe > clean.txt
  cleanary clean urls.txt --mode unique --filepath ./unique.txt
  cleanary duplicates urls.txt --counts
  cleanary replace headlines.txt "FMA warnt vor Angeboten der " "" -o headlines-clean.txt
  cleanary replace - "old" "new" --ignore-case
  fetchary extract links https://example.com --list | cleanary clean
`;

function formatSummary(report, top) {
  const data = [
    ['Total rows', report.totalLines],
    ['Distinct rows', report.distinctLines],
    ['Duplicate groups', report.duplicateGroups],
    ['Extra occurrences', report.extraOccurrences],
    ['Rows in duplicate groups', report.repeatedRows],
    ['Singleton rows', report.singletonRows],
  ];
  let text = `Cleanary — Duplicate analysis\n\n${data.map(([name, n]) => `${name.padEnd(26)} ${n}`).join('\n')}\n`;
  if (report.duplicateGroups && top) {
    text += '\nTop duplicates:\n';
    text += report.duplicates.slice(0, top).map((entry) => `  ${entry.count}x  ${JSON.stringify(entry.value)}`).join('\n') + '\n';
    if (report.duplicateGroups > top) text += `  ... ${report.duplicateGroups - top} more groups\n`;
  }
  return text;
}

function formatDuplicates(groups, options) {
  if (options.json) return JSON.stringify(groups, null, 2) + '\n';
  if (!groups.length) return '';
  return groups.map((entry) => options.counts ? `${entry.count}\t${entry.value}` : entry.value).join('\n') + '\n';
}

async function execute(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  let options;
  try {
    options = parseArgs(argv);
    if (options.version) { stdout.write(`${pkg.version}\n`); return 0; }
    if (options.help || (!argv.length && (io.stdin ?? process.stdin).isTTY)) { stdout.write(HELP); return 0; }
    const input = await readInput(options.input, io.stdin ?? process.stdin, options.maxBytes);
    const matching = { caseSensitive: options.caseSensitive, trim: options.trim };
    let output;
    let report;
    if (options.command === 'analyse') {
      report = api.analyseText(input, matching);
      output = options.json ? JSON.stringify(report, null, 2) + '\n' : formatSummary(report, options.top);
    } else if (options.command === 'duplicates') {
      report = api.analyseText(input, matching);
      output = formatDuplicates(report.duplicates, options);
    } else if (options.command === 'replace') {
      output = api.replaceText(input, options.search, options.replacement, { caseSensitive: options.caseSensitive });
    } else {
      report = api.analyseText(input, matching);
      output = api.cleanText(input, { ...matching, mode: options.mode });
    }
    if (options.filepath) {
      const file = await resolveOutput(options.filepath, options.command, options.json ? 'json' : 'txt');
      await saveOutput(file, output);
      if (options.verbose) stderr.write(`Wrote ${file}\n`);
    } else stdout.write(output);
    if (options.verbose) {
      stderr.write(report
        ? `Analysed ${report.totalLines} rows; ${report.extraOccurrences} extra occurrences in ${report.duplicateGroups} groups.\n`
        : 'Applied literal text replacement.\n');
    }
    return options.check && report.duplicateGroups > 0 ? 3 : 0;
  } catch (error) {
    const usageError = error instanceof CliArgumentError || error instanceof api.CleanaryValidationError || error.code === 'INVALID_UTF8';
    stderr.write(`Error: ${error.message}\n`);
    return usageError ? 2 : 1;
  }
}

if (require.main === module) {
  process.stdout.on('error', (error) => {
    if (error.code === 'EPIPE') process.exit(0);
    else throw error;
  });
  execute(process.argv.slice(2)).then((status) => { process.exitCode = status; });
}

module.exports = { execute, formatSummary, formatDuplicates, HELP };
