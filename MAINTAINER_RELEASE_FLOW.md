# Maintainer Release Flow

This is the maintainer playbook for `gstack-codex`.

It assumes the project keeps shipping the same product shape:

- upstream `garrytan/gstack` is the source of truth
- this repo wraps it for Codex
- public distribution stays on npm as `gstack-codex`
- GitHub Releases mirrors the release assets for trust and debugging

## What Changed

The repo no longer needs a hand-maintained local `.agents/skills/gstack` checkout to
produce release artifacts.

The release flow now has three parts:

1. a tracked upstream pin in [`upstream-gstack.json`](upstream-gstack.json)
2. bootstrap scripts that clone upstream and regenerate Codex artifacts on demand
3. GitHub Actions workflows for sync, auto-release, and publish

## Maintainer Mental Model

Treat the wrapper as two layers:

1. **Upstream layer**
   What commit and version of `garrytan/gstack` are we wrapping?

2. **Wrapper layer**
   How does this repo package, verify, and install that upstream snapshot for Codex users?

That separation matters.

If upstream changes, the first question is not "publish immediately".
The first question is "should we move the tracked pin?"

## Files That Matter

- [`upstream-gstack.json`](upstream-gstack.json)
  Source of truth for the pinned upstream repo, branch, version, and commit.

- [`scripts/bootstrap-upstream-gstack.mjs`](scripts/bootstrap-upstream-gstack.mjs)
  Clones or refreshes upstream and regenerates Codex artifacts from the tracked pin.

- [`scripts/sync-upstream.mjs`](scripts/sync-upstream.mjs)
  Checks the latest upstream `main` commit and optionally updates the tracked pin.

- [`.github/workflows/sync-upstream.yml`](.github/workflows/sync-upstream.yml)
  Manual PR creator for upstream pin bumps. Use this when you want review-first
  upstream updates.

- [`.github/workflows/auto-upstream-release.yml`](.github/workflows/auto-upstream-release.yml)
  Scheduled upstream detector and automatic patch release workflow. It also runs
  when `upstream-gstack.json` lands on `main`, so a reviewed sync PR can still
  flow into publish after merge. It does not call `npm publish` directly. It creates
  the release commit and tag, then dispatches `publish.yml`.

- [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
  Release workflow for npm publish + GitHub Release assets.

- [`docs/release.md`](docs/release.md)
  Technical notes for the artifact flow.

## Normal Weekly Flow

Most of the time, the maintainer should do almost nothing.

### 1. Let `auto-upstream-release` run

`auto-upstream-release.yml` runs weekly and can also be started manually.

What it does:

- checks the latest upstream `main`
- regenerates Codex artifacts in CI
- updates `upstream-gstack.json`
- bumps `package.json` patch version
- runs tests
- builds release artifacts
- creates the npm tarball
- runs the release compatibility gate
- generates an upstream diff report
- commits the pin/version bump to `main`
- creates a matching `vX.Y.Z` tag
- dispatches `publish.yml`
- `publish.yml` publishes to npm and creates or updates GitHub Release assets

If the `release` environment has required reviewers, `publish.yml` waits there before
the public publish. If the environment has no reviewers, the path is fully automatic.

The explicit dispatch is required because release commits and tags are pushed with
GitHub's default `GITHUB_TOKEN`. GitHub does not start new `push` workflow runs from
events created by that token, while `workflow_dispatch` is allowed.

### 2. Use `sync-upstream` when you want review-first

`sync-upstream.yml` is now manual. Start it when you want a PR instead of an
immediate scheduled release.

Review the PR like this:

- Use the PR's upstream compare link to inspect the actual `garrytan/gstack` changes.
- Read the upstream diff report artifact when the file/category summary looks risky.
- Did upstream version/commit move as expected?
- Did tests pass?
- Did release-build smoke pass?
- Did the release compatibility gate pass?
- Is there any upstream change that obviously breaks the Codex wrapper contract?

If yes, merge it.

If not, close it and hold the pin.

If you merge it, `auto-upstream-release.yml` sees the `upstream-gstack.json` change
on `main`, bumps the package patch version, and publishes through the same release
path.

## Release Flow

There are now two release modes.

### Automatic upstream release

This is the weekly default and also the post-merge path for reviewed sync PRs:

1. `auto-upstream-release.yml` detects an upstream commit change.
2. The workflow bumps the wrapper patch version.
3. The workflow creates the release commit and tag.
4. The workflow dispatches `publish.yml`.
5. `publish.yml` publishes to npm and mirrors assets to GitHub Releases.

### Manual wrapper release

Use this for wrapper-only changes or hand-picked releases:

1. Make wrapper changes you want to ship.
2. Update `package.json` version if needed.
3. Push a tag like `v0.1.2`.
4. Let `publish.yml` publish to npm and create the GitHub Release.

### What `publish.yml` does

- checks out the tagged commit
- validates that the tag matches `package.json`
- skips npm publish if that exact package version already exists
- bootstraps upstream from the tracked pin
- upgrades npm to a trusted-publishing-compatible version
- runs tests
- builds release artifacts
- creates the npm tarball artifact
- runs the release compatibility gate
- uploads `upstream-diff-report.md` when a previous release tag is available
- publishes to npm
- creates a GitHub Release with:
  - `release.json`
  - `SHA256SUMS.txt`
  - the npm tarball

## Required One-Time Setup

### 1. Configure npm trusted publishing

On npmjs.com, for package `gstack-codex`:

- configure the single trusted publisher
- provider: GitHub Actions
- organization or user: `phd-peter`
- repository: `gstack-codex`
- workflow filename: `publish.yml`
- environment name: `release`

npm allows one trusted publisher per package. Keep `publish.yml` as that one
publisher. `auto-upstream-release.yml` reaches npm by dispatching `publish.yml`,
not by publishing directly.

After that, restrict publish tokens if you want the safer setup.

Notes:

- the repo must stay public for npm provenance to be generated automatically
- the workflow already uses Node `22.14.0` and upgrades npm to `11.5.1`

### 2. Create the `release` GitHub environment

Recommended:

- environment name: `release`
- add an approval rule if you want human gating before npm publish
- allow deployment refs `main` and `v*`

This is optional for functionality, but recommended for safety.

### 3. Allow Actions to write release commits

The automatic release workflow commits `package.json` and `upstream-gstack.json`
back to `main`, then pushes a matching tag.

GitHub repo settings must allow this:

- `Settings` -> `Actions` -> `General`
- Workflow permissions: read and write
- Allow GitHub Actions to create and approve pull requests: enabled if you use
  `sync-upstream.yml`

If `main` has branch protection, allow GitHub Actions or the repository bot to push
the release bump commit.

## Local Commands

Refresh local upstream cache from the tracked pin:

```bash
npm run bootstrap:upstream
```

Update the tracked upstream pin to the latest upstream `main`:

```bash
npm run sync:upstream
```

Build release artifacts from a prepared upstream checkout:

```bash
$env:GSTACK_CODEX_UPSTREAM_ROOT = (Resolve-Path 'dist/.upstream/gstack').Path
npm run build:release
```

Create the release tarball artifact locally:

```bash
$env:GSTACK_CODEX_UPSTREAM_ROOT = (Resolve-Path 'dist/.upstream/gstack').Path
npm run pack:release
```

## When To Bump What

### Bump `upstream-gstack.json`

Do this when upstream changed and you want this wrapper to track that new snapshot.

This is an input decision.

### Bump `package.json` version

Do this when the wrapper publishes a new npm release.

This is an output decision.

They are related, but not identical.

You may:

- bump upstream pin without publishing immediately
- publish wrapper-only fixes without moving the upstream pin

## Failure Recovery

### `sync-upstream` PR opens but release smoke fails

Do not publish.

Action:

- inspect upstream change
- decide whether the wrapper needs an adaptation
- either fix wrapper compatibility or leave the pin where it was

### npm publish fails in `publish.yml`

Check:

- trusted publisher config on npm
- workflow filename matches `publish.yml`
- the repo is public
- `id-token: write` is still present
- the tag matches `package.json`

### GitHub Release fails after npm publish

That is annoying, but recoverable.

Action:

- re-run only the release creation step manually
- use the artifacts already present under `dist/releases/<version>/`

## What Not To Do

- Do not make GitHub Packages the primary install channel.
- Do not rely on a maintainer laptop checkout as the release source of truth.
- Do not treat the upstream pin and npm version as the same thing.
- Do not run both the scheduled auto-release path and a scheduled sync PR path for
  the same upstream check. The PR workflow is manual now for that reason.

## Current Policy

- npmjs is the primary public distribution channel
- GitHub Releases are the public artifact mirror
- GitHub Packages is not used for primary distribution
- upstream auto-release is the weekly default
- upstream sync PR is available as a manual review-first path

## Short Version

The maintainer flow should feel like this:

1. weekly auto-release checks upstream
2. if upstream changed, it bumps patch version
3. release environment approval happens if configured
4. `publish.yml` handles npm publish and GitHub Release

That's the whole game.
