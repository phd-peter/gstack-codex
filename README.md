# gstack-codex

`gstack-codex` is a Codex-first distribution of `gstack`.

It is built with direct reference to the upstream [`garrytan/gstack`](https://github.com/garrytan/gstack) workflow and repackages that setup for Codex with a smaller install surface.

The install surface is intentionally small:

```bash
npx gstack-codex init --project
npx gstack-codex init --global
```

By default, we recommend installing per project with `init --project`. It keeps skills and routing rules scoped to the repo, makes the setup easier to understand, and avoids turning one machine-wide Codex config into a shared junk drawer across unrelated projects.

`init --project` is the repo-local path. It installs the full generated skill pack into `.agents/skills`, updates `AGENTS.md` with one managed block, and keeps heavy browser/runtime binaries machine-local in v1.
If you're not inside a git repo, it uses the current directory as the project root.

`init --global` is the clean-machine path. It installs the core pack into `$HOME/.agents/skills`, updates `~/.codex/AGENTS.md` with one managed block, and is meant to get a Codex-only user to `/office-hours` quickly.

Compared to setting up upstream `gstack` by hand, `gstack-codex` removes most of the fiddly parts. Instead of cloning skill repos, running setup scripts, and wiring `AGENTS.md` yourself, you run one command and get the managed block, the packaged skills, and the expected Codex layout in place.

## Install

Recommended for most users, per project:

```bash
npx gstack-codex init --project
```

Global install, mainly for a clean Codex-only machine:

```bash
npx gstack-codex init --global
```

Prerequisites:

- `codex` CLI `0.122.0+`
- a signed-in Codex session
- Node.js `18.17+`

Detailed install notes live in [docs/install.md](docs/install.md).

## What Gets Written

Global install writes:

- `~/.codex/AGENTS.md`
- `$HOME/.agents/skills/gstack`
- `$HOME/.agents/skills/gstack-upgrade`
- `$HOME/.agents/skills/gstack-office-hours`
- `$HOME/.agents/skills/gstack-plan-ceo-review`
- `$HOME/.agents/skills/gstack-plan-eng-review`
- `$HOME/.agents/skills/gstack-review`
- `$HOME/.agents/skills/gstack-ship`
- `~/.codex/gstack-codex/install-state.json`

Project install writes:

- `AGENTS.md`
- `.agents/skills/gstack`
- `.agents/skills/gstack-*`
- `.agents/skills/.gstack-codex-manifest.json`

The installer only manages one block inside `AGENTS.md`. If no `AGENTS.md` exists, it creates one.

## Maintainer Flow

Release artifacts are built from the vendored upstream checkout under `.agents/skills/gstack`.

Build the staged release bundle:

```bash
npm run build:release
```

Build the staged bundle and create the npm tarball artifact:

```bash
npm run pack:release
```

This flow writes:

- `bundle/current`
- `dist/releases/<version>/bundle`
- `dist/releases/<version>/release.json`
- `dist/releases/<version>/SHA256SUMS.txt`
- `dist/releases/<version>/npm/*.tgz` after `pack:release`

More detail is in [docs/release.md](docs/release.md).
