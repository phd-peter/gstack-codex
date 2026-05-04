# Release Flow

## Goal

The repo should not depend on a hand-built local `bundle/current` only.

The release flow now does two things:

1. builds a versioned release bundle under `dist/releases/<version>/bundle`
2. stages the same bundle into `bundle/current` so the npm package can ship it

## Commands

Build release artifacts:

```bash
npm run build:release
```

Bootstrap a clean upstream checkout from the tracked pin:

```bash
npm run bootstrap:upstream
```

Refresh the tracked upstream pin to the latest `main` commit:

```bash
npm run sync:upstream
```

Patch-bump the wrapper package version:

```bash
npm run version:patch
```

Create the npm tarball artifact:

```bash
npm run pack:release
```

Run the release compatibility gate:

```bash
npm run check:release
```

## Output Layout

After `build:release`:

- `bundle/current/manifest.json`
- `dist/releases/<version>/bundle/manifest.json`
- `dist/releases/<version>/release.json`
- `dist/releases/<version>/SHA256SUMS.txt`

After `pack:release`:

- `dist/releases/<version>/npm/<package>.tgz`
- `dist/releases/<version>/npm/pack-result.json`

`release.json` tracks the release version, upstream `gstack` version/commit, staged bundle paths, and npm tarball metadata once packed.

## Tracked Upstream Pin

`upstream-gstack.json` is the source of truth for which upstream `garrytan/gstack`
revision this wrapper targets.

- local release builds can still use `.agents/skills/gstack`
- CI release builds should prefer a bootstrapped checkout from `upstream-gstack.json`
- `GSTACK_CODEX_UPSTREAM_ROOT` overrides the default source path for `build:release`

## Integrity

The bundle manifest contains:

- bundle schema version
- package version
- upstream version and commit
- core/full skill lists
- SHA-256 hashes for skill and runtime roots

`SHA256SUMS.txt` adds release-level checksums for the staged manifest, release metadata, and npm tarball artifact.

## Automatic Upstream Release

`.github/workflows/auto-upstream-release.yml` is the scheduled upstream-to-publish
path. It also runs when `upstream-gstack.json` changes on `main`, which covers the
manual sync-PR-then-merge path.

It checks upstream weekly, updates `upstream-gstack.json`, bumps the wrapper patch
version, tests, builds, packs, commits the release bump, pushes a version tag, and
dispatches `publish.yml`.

The dispatch is intentional. Release commits and tags are pushed with the default
`GITHUB_TOKEN`; GitHub does not start new `push` workflow runs from events created
by that token, while `workflow_dispatch` is allowed.

`publish.yml` remains the only npm trusted publisher workflow. This matters because
npm allows one trusted publisher per package.

The older `sync-upstream.yml` workflow is now a manual review-first path. Use it
when you want a PR before release. Merging that PR still triggers the automatic
release workflow.

Before opening the PR, `sync-upstream.yml` runs tests, builds release artifacts,
packs the npm artifact, runs the release compatibility gate, and generates an
upstream diff report from the candidate upstream checkout. The generated bundle is
still not committed to `main`; the PR records the pin plus an upstream compare link,
commit/file counts, and a workflow artifact with the full diff report. The publish
workflow rebuilds the bundle from that pin.

`publish.yml` also runs the compatibility gate after packing and uploads
`upstream-diff-report.md` to the GitHub Release when a previous release tag is
available for comparison.

## Terminal And Log Hygiene

Workflow jobs set:

- `LANG=C.UTF-8`
- `LC_ALL=C.UTF-8`
- `NO_COLOR=1`
- `FORCE_COLOR=0`

Project-owned automation output should stay ASCII where practical. This keeps logs
readable in Windows terminals that are still using a legacy code page.
