# Publishing Cleanary to npm and Homebrew

## Publish to the local Homebrew tap

After the current `package.json` version is available on npm, run:

```bash
npm run brew:publish
```

This downloads that version's published npm tarball, computes its SHA-256, and generates `Formula/cleanary.rb`. It then fast-forwards the local `../homebrew-tap` checkout, writes the formula there, commits only that file, and pushes to `origin/main` using your existing Git credentials. No tap token or GitHub API setup is needed. `npm run brew:push` is an alias for the same command.

The command publishes only the Homebrew formula; the package version must already exist on npm. Immediately after npm publication, a cached 404 can temporarily hide the tarball. Downloads retry with fresh query parameters while the generated formula retains the canonical npm URL. If all retries fail, rerun the command once the tarball is available.

The tap must be a clean Git checkout on `main` with an `origin` remote and no unpushed commits. Existing local work is left untouched if these checks fail. An unchanged formula does not create another commit. If the push fails after committing, retry it from the tap with `git -C ../homebrew-tap push origin main`.

To generate a formula for inspection without committing or pushing:

```bash
npm run brew:formula
# Or specify an already published version and an exact destination:
node scripts/generate-homebrew-formula.mjs 0.1.1 dist/Formula/cleanary.rb
```

Generated files under `dist/` are ignored in Cleanary. The published formula lives in `oliverjessner/homebrew-tap`.

## Publish the npm package

For a local npm release, use Node.js 26 or newer and a version that has not already been published:

```bash
npm ci
npm test
npm run pack:check
npm login
npm publish --access public
npm run brew:publish
```

Never commit credentials or republish an existing npm version. Keep `package.json`, both version fields in `package-lock.json`, and the changelog aligned.

## Optional npm publication through GitHub Actions

For npm package `cleanary`, configure a GitHub Actions trusted publisher with user `oliverjessner`, repository `cleanary`, and workflow filename `publish.yml`. Leave the optional environment empty and grant permission for `npm publish`. See the [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

Publish a stable GitHub release tagged `vX.Y.Z` at the commit containing that package version. `.github/workflows/publish.yml` validates the tag and package/lockfile versions, runs tests and the package dry run on Node.js 26, and publishes to npm using OIDC and provenance. Drafts, prereleases and ordinary Git pushes do not publish npm packages. Pushes to `main` and pull requests run `.github/workflows/test.yml` without publishing.

After npm publication, run `npm run brew:publish` locally to update the neighboring tap. GitHub Actions does not update the tap.

Validate release metadata before tagging, using the current package version:

```bash
npm run release:check -- v0.1.1
```

## Installation checks

```bash
npm view cleanary version
brew update
brew info oliverjessner/tap/cleanary
brew install oliverjessner/tap/cleanary
```
