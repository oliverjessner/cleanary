# Cleanary 🧹

[![CI](https://github.com/oliverjessner/cleanary/actions/workflows/test.yml/badge.svg)](https://github.com/oliverjessner/cleanary/actions/workflows/test.yml)

Cleanary is a command-line tool for cleaning text files one line at a time.
It finds repeated lines, removes unwanted copies and replaces literal text.
You can keep the original line order and save results without overwriting existing files.

Start by analyzing a list of URLs, headlines or other text to see which lines repeat most often. Then choose whether to keep one copy of each line or only lines that appear once, and save the result to a new file or pass it to another command.

## What it does

- Count total lines, distinct values and extra copies.
- List repeated values with occurrence counts or JSON output.
- Keep one copy of each line, or remove every occurrence of repeated values.
- Optionally ignore case and surrounding whitespace when comparing lines.
- Replace or remove literal text across all lines.
- Read UTF-8 files or piped input and save results to new files.

## Install

### Homebrew

On macOS or Linux:

```bash
brew install oliverjessner/tap/cleanary
```

Homebrew installs Node.js as a dependency. Cleanary requires Node.js 26 or newer.

### npm

With Node.js 26 or newer on macOS, Linux or Windows:

```bash
npm install --global cleanary
```

## CLI

Analyze duplicates, clean lists and replace text directly from your terminal.

```bash
printf 'apple\napple\nbanana\n' | cleanary clean
```

This prints `apple` and `banana`, each on its own line.

See the [CLI documentation](docs/CLI.md) for all commands and options.

## Find the most frequent lines

Use `cleanary analyse urls.txt` to see how many lines repeat and which values occur most often. Use `cleanary duplicates urls.txt --counts` for a list of repeated values with counts, or add `--json` for structured output.

## Choose what to keep

The default `clean` mode keeps the first copy of each line; `--mode unique` keeps only lines that appear once. Both preserve the order and text of retained lines, even when `--ignore-case` or `--trim` changes how duplicates are matched.

## Replace text across a list

Use `cleanary replace headlines.txt "old name" "new name"` to replace every literal match, or omit the replacement to remove matching text. Replacement preserves duplicate lines, empty lines and original line endings.

## Save results and connect commands

Read from a file or pipe, then send the result to another command or save it with `--filepath cleaned.txt`. Cleanary leaves the input file untouched and refuses to overwrite existing output files when saving with `--filepath`.

## Who it is for

- Researchers cleaning lists of URLs, names or collected text.
- Writers and editors removing repeated headlines or unwanted text.
- Command-line users preparing text lists for other tools.

## Changelog

See the [changelog](docs/changelog.md) for release notes and changes.

## License

MIT
