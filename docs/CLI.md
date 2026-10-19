# Cleanary CLI

The CLI shares all matching logic with the public Node.js library. It never rewrites the source input file.

## Commands

```text
cleanary [analyse] [file|-] [options]
cleanary clean [file|-] [--mode dedupe|unique] [options]
cleanary duplicates [file|-] [--counts|--json] [options]
cleanary replace <file|-> <search> [replacement] [options]
```

`analyse` (also `analyze`) is the default command and prints a human-readable summary. The input defaults to stdin, allowing shell pipelines. `--help` and `--version` do not consume stdin.

### Definitions

For `a, b, a, a, c, b`:

| Metric | Value | Meaning |
| --- | ---: | --- |
| totalLines | 6 | Input rows, including empty rows |
| distinctLines | 3 | Number of distinct normalized matching keys |
| duplicateGroups | 2 | Keys with a frequency greater than one |
| extraOccurrences | 3 | Total copies beyond the first per key |
| repeatedRows | 5 | Every row belonging to a repeated key |
| singletonRows | 1 | Rows whose matching key occurs exactly once |

`analyse --json` emits the six counts above plus a `duplicates` array of `{ "value": "a", "count": 3, "firstLine": 1 }` objects, sorted by frequency and then first occurrence. `--top` limits **only** the human-readable report, not JSON.

`clean --mode dedupe` returns `a, b, c`. `clean --mode unique` returns `c`. The `duplicates` command prints `a, b` once each, not all five repeated rows; add `--counts` to print `3\ta` and `2\tb`, or `--json` for structured data.

### Literal replacement

```bash
cleanary replace headlines.txt "FMA warnt vor Angeboten der " "" --filepath headlines-clean.txt
cleanary replace headlines.txt "old" "new" --ignore-case
cat headlines.txt | cleanary replace - "unwanted prefix "
```

`replace` requires an input path or `-` for stdin, a non-empty search string, and an optional replacement string. The default replacement is empty; passing `""` also removes matches. Every occurrence is replaced in every row, with case-sensitive matching by default. `--ignore-case` uses Unicode case-insensitive matching while retaining the literal meaning of the search string.

Search and replacement must be single-line strings: LF and CR are rejected. Regex punctuation such as `.*` in the search and dollar sequences such as `$&` in the replacement are treated literally. To use text beginning with a CLI flag, place `--` before all positional arguments, for example `cleanary replace -- headlines.txt "--prefix" ""`.

Replacement preserves row order, duplicate and empty rows, the BOM, and exact line endings, including mixed LF/CRLF or CR and a missing final newline. It emits plain text and supports `--filepath`, `--output`, `-o`, `--stdout`, `--max-bytes`, and `--verbose`. Duplicate-specific options (`--trim`, `--mode`, `--counts`, `--json`, `--top`, `--check`) are rejected. To deduplicate the replaced text, pipe it into `cleanary clean`.

### Options

| Flag | Purpose |
| --- | --- |
| `--ignore-case` | Compare duplicate keys after `.toLowerCase()`; use Unicode case-insensitive matching for replacement |
| `--case-sensitive` | Exact case-sensitive comparison (default) |
| `--trim` | Ignore leading and trailing whitespace in duplicate matching keys; unsupported for `replace` |
| `--mode dedupe\|unique` | Clean mode (default: `dedupe`) |
| `--counts` | Count + tab + original first value in `duplicates` |
| `--json` | JSON for `analyse` / `duplicates` |
| `--top <n>` | Human-readable `analyse` display limit (default: 10; 0 hides groups) |
| `--check` | `analyse` exits 3 if duplicates exist |
| `--filepath <path>` | Save to new file or auto-generated file in a directory |
| `--output <path>` / `-o <path>` | Aliases for `--filepath` |
| `--stdout` | Use stdout (default); incompatible with `--filepath` |
| `--max-bytes <bytes>` | Input cap (default: 134217728 = 128 MiB) |
| `--verbose` | Diagnostic summary on stderr |
| `--no-color` | Explicitly colorless output; output is always plain text |
| `--help` / `-h` | Help |
| `--version` / `-v` | Package version |

Only one input path is allowed. Paths of `-` are read from stdin. Invalid UTF-8 input is rejected. Files are not overwritten. For new directories, parent directories are created if needed. An existing directory or a path ending in a slash or with no extension is treated as an output directory. Directories get unique filename with command, timestamp and random suffix. Every output file is opened exclusively and created with mode `0600` (POSIX). Errors never include the file content.

### Pipeline examples

```bash
cleanary analyse corpus.txt --top 20
cleanary analyse corpus.txt --check || echo "Duplicates found"
cleanary clean corpus.txt --ignore-case --trim > collapsed.txt
cleanary clean corpus.txt --mode unique -o unique.txt
cat corpus.txt | cleanary duplicates --counts | sort -nr
cleanary replace headlines.txt "FMA warnt vor Angeboten der " | cleanary clean > unique-headlines.txt
```

**Exit codes:** 0 success, 1 I/O or exceeded byte limit, 2 argument/validation/UTF-8 error, 3 duplicates detected with `analyse --check`. Normal operations always exit 0 even when duplicates exist.

**Data model:** Duplicate operations compare one row per LF (`\n`) or CRLF (`\r\n`). They preserve the original first version in `dedupe` mode and relative ordering in both modes. Mixed line endings become uniform using the first encountered style. Empty lines are counted, and an optional initial BOM is preserved. Duplicate comparison without case sensitivity uses JavaScript lowercasing; it is not fuzzy matching. The `replace` command preserves every original line ending and keeps matches within each row.
