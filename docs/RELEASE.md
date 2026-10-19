# Publishing Cleanary to npm and Homebrew

This repository is prepared for distribution, **but publishing requires the maintainer's npm account and a GitHub token for the separate Homebrew tap**.

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

For npm package `cleanary`, add a GitHub Actions trusted publisher with user `oliverjessner`, repo `cleanary`, and workflow filename `publish.yml`. **Explicitly grant permission for `npm publish`** in the trusted publisher's allowed actions. GitHub Actions uses OIDC (`id-token: write`) so no persistent npm token is needed. npm can automatically attach provenance attestations.

## 3. Configure Homebrew tap access

There is a separate public repository at `oliverjessner/homebrew-tap`. Add `HOMEBREW_TAP_TOKEN` as a GitHub Actions repository secret in `oliverjessner/cleanary`. It should be a **fine-grained token** restricted to `oliverjessner/homebrew-tap` with **Contents: Read and write**, and no unnecessary scopes. The workflow checks that it exists before attempting npm publication.

The generated formula uses the actual published npm tarball and its SHA-256. The workflow updates `Formula/cleanary.rb` on the tap's default `main` branch. Only this path is modified. Review the token permissions and the formula before enabling this automation.

## 4. Release

After updating the package version, commit and merge to `main`, then create a matching GitHub release tagged `vX.Y.Z`. `.github/workflows/publish.yml` verifies that the tag matches `package.json`, tests on Node.js 26, publishes the package to npm, computes its SHA-256 from the npm tarball, and updates the Homebrew tap.

Manual formula generation after npm publication is also supported:

```bash
npm run brew:formula
# Or specify the published version and an exact destination:
node scripts/generate-homebrew-formula.mjs 0.1.0 dist/Formula/cleanary.rb
```

The generated `dist/Formula/cleanary.rb` is not committed to Cleanary. The published Homebrew formula lives in `oliverjessner/homebrew-tap`.

Once both channels are published, end users can run:

```bash
npm install --global cleanary
# or
brew install oliverjessner/tap/cleanary
```

Useful checks: `npm view cleanary version`, `brew update`, `brew info oliverjessner/tap/cleanary`, and `brew audit --tap=oliverjessner/tap cleanary` where supported.

Security notes: no long-lived npm token is needed for recurring releases; the tap's GitHub token is scoped to one repository. The CLI will not overwrite existing files. The Homebrew tap should never point to placeholder hashes or unversioned archives.
