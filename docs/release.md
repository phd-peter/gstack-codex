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

## Integrity

The bundle manifest contains:

- bundle schema version
- package version
- upstream version and commit
- core/full skill lists
- SHA-256 hashes for skill and runtime roots

`SHA256SUMS.txt` adds release-level checksums for the staged manifest, release metadata, and npm tarball artifact.

## Current Boundary

This is a publishable artifact flow, not yet an automatic upstream sync system.

Weekly upstream sync remains deferred work.
