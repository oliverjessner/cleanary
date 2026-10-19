# Changelog

## 0.1.3

- Add `cleanary replace <file|-> <search> [replacement]` to replace all literal matches per row, with optional case-insensitive matching and empty replacement by default.
- Expose `replaceText` and `replaceLines` through CommonJS, ESM, and TypeScript declarations.
- Preserve duplicate and empty rows, the UTF-8 BOM and exact line endings during replacement; support the existing exclusive file and directory output options.
- Preserve the UTF-8 BOM when reading CLI input for all commands.

## 0.1.1

- Publish the Homebrew formula through the local `../homebrew-tap` checkout with `npm run brew:publish`, using existing Git credentials.
- GitHub Actions publishes to npm independently of the local Homebrew tap.

## 0.1.0 – initial implementation (unreleased until npm publication)

- Dependency-free Node.js 26 CLI and library with CommonJS, ESM and TypeScript types.
- Count, inspect and remove repeated text rows using `dedupe` and `unique` modes.
- UTF-8 file and stdin input; stdout and exclusive output files; optional case-insensitive and trimmed matching.
- Structured JSON analysis, repeated-group counts, and CI-friendly duplicate check exit code.
- GitHub Actions test and release workflows for npm Trusted Publishing.
- Stable releases validate matching package/lockfile versions before publication.
