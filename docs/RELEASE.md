# Publishing Cleanary to npm and Homebrew

Publishing a stable GitHub release runs `.github/workflows/publish.yml`: it validates the tag and package versions, runs the tests, publishes to npm, and then updates the separate Homebrew tap. **The maintainer must first configure npm Trusted Publishing and the tap token below.** Pushes to `main` and pull requests run `.github/workflows/test.yml` without publishing.

## 1. Bootstrap the npm package name (one-time)

Confirm `cleanary` is available in the npm registry and that the npm account has rights to publish it. The initial npm release may need to be completed interactively to create the package before Trusted Publishing can be configured. From a clean checkout using Node.js 26:

```bash
npm ci
npm test
npm run pack:check
npm login
npm publish --access public
```

**Do not publish a version that already exists.** After this initial `0.1.0` release, bump `package.json` and `package-lock.json` to the next version (for example `0.1.1`) for automated releases. Never commit tokens to source control.

## 2. Configure Trusted Publishing on npmjs.com

For npm package `cleanary`, add a GitHub Actions trusted publisher with user `oliverjessner`, repo `cleanary`, and workflow filename `publish.yml` (only the filename, no path). Leave the optional environment empty; the workflow does not use a GitHub environment. **Explicitly grant permission for `npm publish`** in the trusted publisher's allowed actions. GitHub Actions uses OIDC (`id-token: write`) and `npm publish --access public --provenance`, so no persistent npm token is needed. See the [npm Trusted Publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## 3. Configure Homebrew tap access

There is a separate public repository at `oliverjessner/homebrew-tap`. Add `HOMEBREW_TAP_TOKEN` as a GitHub Actions repository secret in `oliverjessner/cleanary`. It should be a **fine-grained token** restricted to `oliverjessner/homebrew-tap` with **Contents: Read and write**, and no unnecessary scopes. The workflow checks that it exists before attempting npm publication.

The generated formula uses the actual published npm tarball and its SHA-256. The workflow updates `Formula/cleanary.rb` on the tap's default `main` branch. Only this path is modified. Review the token permissions and the formula before enabling this automation.

The update uses the GitHub Contents API to commit directly to `oliverjessner/homebrew-tap`. It does not use or modify the local `../homebrew-tap` checkout. The tap must allow the token to commit to `main`; branch rules requiring pull requests will block this update. The built-in `GITHUB_TOKEN` belongs to Cleanary and cannot replace the separate tap token.

## 4. Release

Update `package.json`, both version fields in `package-lock.json`, and the changelog, then commit and merge to `main`. Create and publish a matching stable GitHub release tagged `vX.Y.Z` at that commit. Drafts, prereleases and ordinary Git pushes do not publish packages. A prerelease version such as `0.2.0-beta.1` is rejected if marked as a stable release.

The `publish` job verifies that the tag matches `package.json` and `package-lock.json`, requires `HOMEBREW_TAP_TOKEN` before npm publication, runs tests and the package dry run on Node.js 26, and publishes the package using npm Trusted Publishing. The dependent `homebrew` job downloads that version's npm tarball, computes its SHA-256, and commits the generated formula to the tap. Release runs are serialized so they do not update the formula concurrently.

If npm publication succeeds but the tap update fails, fix the token or tap permissions and select **Re-run failed jobs** in GitHub Actions. This reruns `homebrew` without trying to publish the immutable npm version again. An unchanged formula is detected and does not create another commit. Do not rerun all jobs after a successful npm publication.

Validate the release metadata locally before tagging:

```bash
npm run release:check -- v0.1.0
```

Use the actual version from `package.json`. A mismatched tag or lockfile fails before publication.

Manual formula generation after npm publication is also supported:

```bash
npm run brew:formula
# Or specify the published version and an exact destination:
node scripts/generate-homebrew-formula.mjs 0.1.0 dist/Formula/cleanary.rb
```

To update the tap manually for the current `package.json` version, first generate its formula with `npm run brew:formula`, then run `npm run brew:push` with `HOMEBREW_TAP_TOKEN` supplied through your environment. This command creates a remote commit; keep the token out of source files and shell history.

The generated `dist/Formula/cleanary.rb` is not committed to Cleanary. The published Homebrew formula lives in `oliverjessner/homebrew-tap`.

Once both channels are published, end users can run:

```bash
npm install --global cleanary
# or
brew install oliverjessner/tap/cleanary
```

Useful checks: `npm view cleanary version`, `brew update`, `brew info oliverjessner/tap/cleanary`, and `brew audit --tap=oliverjessner/tap cleanary` where supported.

Security notes: no long-lived npm token is needed for recurring releases; the tap's GitHub token is scoped to one repository. The CLI will not overwrite existing files. The Homebrew tap should never point to placeholder hashes or unversioned archives.
