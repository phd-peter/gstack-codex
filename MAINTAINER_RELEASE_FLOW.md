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
3. GitHub Actions workflows for sync and publish

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
  Scheduled PR creator for upstream pin bumps.

- [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
  Release workflow for npm publish + GitHub Release assets.

- [`docs/release.md`](docs/release.md)
  Technical notes for the artifact flow.

## Normal Weekly Flow

Most of the time, the maintainer should do almost nothing.

### 1. Let `sync-upstream` open a PR

`sync-upstream.yml` runs weekly and can also be started manually.

What it does:

- checks the latest upstream `main`
- regenerates Codex artifacts in CI
- runs tests
- runs release-build smoke against the bootstrapped upstream checkout
- opens a PR if `upstream-gstack.json` changes

### 2. Review the PR

Review it like this:

- Did upstream version/commit move as expected?
- Did tests pass?
- Did release-build smoke pass?
- Is there any upstream change that obviously breaks the Codex wrapper contract?

If yes, merge it.

If not, close it and hold the pin.

## Release Flow

Releases should be tag-driven.

### Recommended sequence

1. Merge the upstream sync PR, or make wrapper changes you want to ship.
2. Update `package.json` version if needed.
3. Push a tag like `v0.1.2`.
4. Let `publish.yml` publish to npm and create the GitHub Release.

### What `publish.yml` does

- checks out the tagged commit
- validates that the tag matches `package.json`
- bootstraps upstream from the tracked pin
- upgrades npm to a trusted-publishing-compatible version
- runs tests
- builds release artifacts
- creates the npm tarball artifact
- publishes to npm
- creates a GitHub Release with:
  - `release.json`
  - `SHA256SUMS.txt`
  - the npm tarball

## Required One-Time Setup

### 1. Configure npm trusted publishing

On npmjs.com, for package `gstack-codex`:

- add a trusted publisher
- provider: GitHub Actions
- organization or user: `phd-peter`
- repository: `gstack-codex`
- workflow filename: `publish.yml`

After that, restrict publish tokens if you want the safer setup.

Notes:

- the repo must stay public for npm provenance to be generated automatically
- the workflow already uses Node `22.14.0` and upgrades npm to `11.5.1`

### 2. Create the `release` GitHub environment

Recommended:

- environment name: `release`
- add an approval rule if you want human gating before npm publish

This is optional for functionality, but recommended for safety.

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
- Do not auto-publish directly from the weekly sync job.
- Do not rely on a maintainer laptop checkout as the release source of truth.
- Do not treat the upstream pin and npm version as the same thing.

## Current Policy

- npmjs is the primary public distribution channel
- GitHub Releases are the public artifact mirror
- GitHub Packages is not used for primary distribution
- upstream sync is review-first, not auto-publish

## Short Version

The maintainer flow should feel like this:

1. weekly upstream PR appears
2. review it
3. merge if good
4. tag when ready to ship
5. publish workflow handles npm + GitHub Release

That's the whole game.
