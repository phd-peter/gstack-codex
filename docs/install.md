# Install Guide

## Global Install

Use this on a clean machine:

```bash
npx gstack-codex init --global
```

What it does:

- verifies `codex` CLI `0.122.0+`
- verifies Codex auth state
- writes one managed block into `~/.codex/AGENTS.md`
- installs the core pack into `$HOME/.agents/skills`
- migrates the legacy `~/.codex/skills/gstack` path into a backup if it exists

Core pack in v1:

- `/office-hours`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/review`
- `/ship`

Result:

- open Codex
- run `/office-hours`

## Project Install

Use this inside a git repo:

```bash
npx gstack-codex init --project
```

What it does:

- finds the current repo root
- writes one managed block into repo `AGENTS.md`
- installs the full generated Codex skill pack into repo `.agents/skills`
- writes `.agents/skills/.gstack-codex-manifest.json`

v1 note:

- generated skills and lightweight runtime assets are repo-local
- heavier browser/runtime binaries remain machine-local

## Managed Block Rules

`gstack-codex` does not take over the whole `AGENTS.md`.

It only owns this block:

```md
<!-- BEGIN GSTACK-CODEX MANAGED BLOCK -->
...
<!-- END GSTACK-CODEX MANAGED BLOCK -->
```

If the file already contains that block, the installer replaces only that block.

If the file contains multiple broken or duplicate managed blocks, the installer refuses to rewrite it.

## Refusal Cases

The installer fails instead of overwriting user-owned content when:

- a target skill directory already exists but is not listed in prior `gstack-codex` install state
- `AGENTS.md` already contains broken or duplicated `gstack-codex` managed markers
- the release bundle is missing or fails integrity checks

These refusal paths are intentional. The goal is rollback-safe installation, not best-effort mutation.
