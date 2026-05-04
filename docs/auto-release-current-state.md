# Auto Release Current State

Updated: 2026-05-04

## What Changed

The original idea was:

1. keep the existing `publish.yml` trusted publisher
2. add `auto-upstream-release.yml` as another npm trusted publisher
3. let the new workflow publish directly

That is not possible.

npm currently allows only one trusted publisher per package. For `gstack-codex`,
that one publisher must remain:

- `.github/workflows/publish.yml`

So the final design is:

1. `auto-upstream-release.yml` detects upstream changes
2. it updates `upstream-gstack.json`
3. it bumps `package.json` patch version
4. it runs tests and release packaging as a smoke check
5. it runs the release compatibility gate
6. it generates an upstream diff report
7. it commits the release bump to `main`
8. it creates and pushes `vX.Y.Z`
9. it dispatches `publish.yml` with the tag input
10. `publish.yml` performs the actual npm publish and GitHub Release upload

## Workflow Roles

| Workflow | Trigger | Role | Publishes to npm? |
|---|---|---|---|
| `auto-upstream-release.yml` | schedule, manual, `upstream-gstack.json` push to `main` | Detect, bump, test, commit, tag, dispatch publish | No |
| `publish.yml` | tag push, manual dispatch | Trusted npm publish and GitHub Release assets | Yes |
| `sync-upstream.yml` | manual only | Review-first upstream PR path | No |

## What Lands In `main`

`main` does not store the full generated upstream bundle.

On an upstream release, `main` gets:

- `upstream-gstack.json`, the exact upstream version and commit
- `package.json`, the wrapper package version bump

The generated upstream skill bundle is created during release build and included in
the npm tarball under:

- `bundle/current`

This is intentional. The repo stores provenance, not a large vendored generated tree.
The release artifact stores the actual generated content users install.

## What A Reviewer Sees Before Merge

The manual review path is `sync-upstream.yml`.

That PR includes:

- previous upstream version and commit
- next upstream version and commit
- an upstream compare link
- a successful test, release build, and npm pack smoke check before PR creation
- a release compatibility gate check before PR creation
- an upstream diff report attached to the workflow run
- a note that the full generated bundle is rebuilt at release time

So the code diff in this repo is small by design, but the PR points to the upstream
content that will be packaged.

## Why `publish.yml` Must Stay The Trusted Publisher

npm checks the GitHub workflow identity during trusted publishing. Since npm only
allows one trusted publisher per package, the package should trust the workflow that
actually runs `npm publish`.

That workflow is `publish.yml`.

`auto-upstream-release.yml` does not need to be trusted by npm because it does not
call `npm publish`.

It does need `actions: write` so it can trigger `publish.yml` with
`workflow_dispatch`. A tag pushed with the default `GITHUB_TOKEN` does not start a
new `push`-triggered workflow run, so relying on the tag push alone would not
publish.

## End-To-End Automatic Path

Scheduled path:

1. GitHub runs `auto-upstream-release.yml` weekly.
2. It compares the pinned upstream commit with `garrytan/gstack@main`.
3. If nothing changed, it exits.
4. If upstream changed, it bootstraps the latest upstream checkout.
5. It updates `upstream-gstack.json`.
6. It bumps `package.json`, for example `0.2.0` to `0.2.1`.
7. It runs `bun test`.
8. It builds release artifacts and packs the npm tarball as a smoke check.
9. It runs the release compatibility gate.
10. It generates an upstream diff report.
11. It commits `package.json` and `upstream-gstack.json`.
12. It pushes the release commit to `main`.
13. It pushes the matching tag.
14. It calls `publish.yml` with `tag=vX.Y.Z`.
15. `publish.yml` checks out that tag.
16. `publish.yml` bootstraps the pinned upstream again.
17. `publish.yml` tests, builds, packs, checks compatibility, publishes to npm, and uploads GitHub Release assets.

Review-first path:

1. A maintainer manually runs `sync-upstream.yml`.
2. It opens an upstream sync PR.
3. If the maintainer merges the PR, `upstream-gstack.json` changes on `main`.
4. That push triggers `auto-upstream-release.yml`.
5. From there, the same release path runs.

## Required External Setup

### npm

Keep exactly one trusted publisher:

| Field | Value |
|---|---|
| Provider | `GitHub Actions` |
| Organization or user | `phd-peter` |
| Repository | `gstack-codex` |
| Workflow filename | `publish.yml` |
| Environment name | `release` |

Do not configure `auto-upstream-release.yml` in npm.

### GitHub Actions Permissions

Repo settings must allow workflows to write:

- `Settings` -> `Actions` -> `General`
- `Workflow permissions`: `Read and write permissions`

This is needed because `auto-upstream-release.yml` pushes:

- one release commit to `main`
- one `vX.Y.Z` tag

It also needs `actions: write` in the workflow so it can dispatch `publish.yml`.

### GitHub `release` Environment

The `release` environment is used by `publish.yml`, not by `auto-upstream-release.yml`.

Allow deployment refs:

- `main`, for manual dispatch from `auto-upstream-release.yml`
- `v*`, for tag-triggered manual releases

Approval options:

- keep required reviewers for approval before npm publish
- remove required reviewers for fully automatic publish

## What Was Removed

Removed:

- `docs/auto-upstream-release-plan.md`

Reason:

- it was an implementation plan from the earlier design
- it said the new workflow should publish directly
- that conflicts with npm's one-trusted-publisher limit
