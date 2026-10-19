# Cleanary

> **Keep only what matters.**

Cleanary is a small, dependency-free toolkit for cleaning text lines in your terminal and Node.js apps.
Count repeated lines, remove extra copies or every repeated value, and replace literal text across all rows. The CLI reads UTF-8 files or stdin and writes plain text to stdout or a new file.

## Install

Node.js 26 or newer is required.

Once the package is released on npm:

```bash
npm install --global cleanary
```

For a Node.js project:

```bash
npm install cleanary
```

Once the Homebrew formula is released in [oliverjessner/homebrew-tap](https://github.com/oliverjessner/homebrew-tap):

```bash
brew install oliverjessner/tap/cleanary
```

Before the first release, clone this repository and run `npm link` for local CLI usage.

## Examples

### Count duplicate rows

```bash
cleanary analyse urls.txt
cleanary analyse urls.txt --ignore-case
cleanary analyse urls.txt --json
```

For the input `a`, `b`, `a`, `a`, `c`, `b`, the report shows **6 total rows**, **3 distinct rows**, **2 duplicate groups** and **3 extra occurrences**. Groups are displayed in descending order of frequency.

### Keep one copy of every row

```bash
cleanary clean urls.txt --mode dedupe > deduped.txt
```

`dedupe` is the default mode. It keeps the first version of each row, in its original position. Even with `--ignore-case` or `--trim`, it does not rewrite the text of the retained rows.

### Keep only truly unique rows

Remove **every** occurrence of a value if that value appears more than once:

```bash
cleanary clean urls.txt --mode unique --filepath unique.txt
```

Unlike `dedupe`, `unique` does not preserve one copy of repeated values. Only rows whose frequency is exactly one remain.

### Show which rows repeat

```bash
cleanary duplicates urls.txt
cleanary duplicates urls.txt --counts
cleanary duplicates urls.txt --json
```

`duplicates` prints each repeated value **once**, ordered by frequency. `--counts` prefixes the count and a tab; `--json` includes each value, count and original line number.

### Replace or remove text in every row

```bash
cleanary replace headlines.txt "FMA warnt vor Angeboten der " "" -o headlines-clean.txt
cleanary replace headlines.txt "old name" "new name" --ignore-case
cat headlines.txt | cleanary replace - "unwanted prefix " > headlines-clean.txt
```

`replace` changes every literal occurrence in each row. Omit the replacement or pass `""` to remove matches. It retains duplicate and empty rows, the BOM, and all original line endings. Search and replacement are single-line strings; punctuation and dollar signs are literal. Use `-` explicitly for stdin.

### Use pipes and other tools

```bash
cat urls.txt | cleanary analyse
cat urls.txt | cleanary clean --ignore-case > clean.txt
fetchary extract links https://oliverjessner.at/sitemap.xml --list | cleanary clean
```

`-` can also be used explicitly for stdin (`cleanary analyse -`). The CLI prints analysis results or cleaned rows to stdout. Diagnostics and errors go to stderr, so pipelines remain clean.

### Save without overwriting existing files

```bash
cleanary clean urls.txt --filepath ./cleaned.txt
cleanary duplicates urls.txt --counts --filepath ./reports/
```

`--filepath`, `--output`, and `-o` select the output. Existing files are never overwritten. With a directory, Cleanary generates a timestamped filename. New files are private (`0600` on POSIX).

## Use Cleanary in Node.js

```js
const { analyseText, cleanText, findDuplicates, replaceText } = require('cleanary');

const text = 'Apple\nBanana\napple\nApple\n';
const report = analyseText(text, { caseSensitive: false });
const rows = cleanText(text, { caseSensitive: false, mode: 'dedupe' });
const groups = findDuplicates(['A', 'B', 'A']);

console.log(report.extraOccurrences); // 2
console.log(rows); // Apple\nBanana\n
console.log(groups); // [{ value: 'A', count: 2, firstLine: 1 }]
console.log(replaceText('old old\n', 'old', 'new')); // 'new new\n'
```

Both CommonJS and ESM named imports are supported. TypeScript declarations are included. Use `normalize: value => ...` to add project-specific matching rules without changing the core.

## Matching and data safety

- **Exact matching** is the default; `--ignore-case` enables Unicode lowercasing, and `--trim` optionally ignores outer whitespace **for comparison only**.
- Both modes keep the original order and retained line contents; LF/CRLF style and trailing newline are preserved for uniform-input files. Mixed endings are normalized to the first encountered style.
- `replace` changes literal text within rows and preserves all original line endings, including mixed endings. It supports `--ignore-case` and the same file output options.
- Empty lines count as rows. Files must be UTF-8. An initial UTF-8 BOM is accepted.
- The CLI has a configurable 128 MiB input limit (`--max-bytes`). Analysis and cleaning are in-memory in v0.1.0, so available RAM also matters.
- `--check` on `analyse` exits with code **3** when duplicates exist, useful for CI. Invalid arguments exit **2**; input/output errors exit **1**.

The tool performs exact/key-based line matching, not fuzzy matching or URL canonicalization. Any extra matching logic belongs in a custom library normalizer or a future extension.

## Documentation

- [CLI reference](docs/CLI.md) – commands, flags, examples and exit codes.
- [Library guide](docs/LIBRARY.md) – exports, schemas, custom normalization and TypeScript.
- [Release guide](docs/RELEASE.md) – npm Trusted Publishing, GitHub releases and Homebrew tap.
- [Changelog](docs/changelog.md) – releases and notable changes.

## License

MIT © 2026 Oliver Jessner.
