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

Create the npm tarball artifact:

```bash
npm run pack:release
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

## Current Boundary

This is now a publishable artifact flow with a tracked upstream pin and a starter
`sync-upstream.yml` workflow.

Automatic publish remains deferred work.
