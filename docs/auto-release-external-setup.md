# Auto Release External Setup

This checklist covers the GitHub and npm settings required for the fully automated
upstream release path.

The workflow files are:

- `.github/workflows/auto-upstream-release.yml`
- `.github/workflows/publish.yml`

## 1. Keep `publish.yml` As The Only npm Trusted Publisher

npm currently allows only one trusted publisher per package. That means you cannot
keep `publish.yml` and add `auto-upstream-release.yml` as a second trusted publisher.

The correct setup is:

- npm trusts `publish.yml`
- `auto-upstream-release.yml` prepares the release commit and tag
- `auto-upstream-release.yml` then dispatches `publish.yml`
- `publish.yml` does the actual npm publish

So if `publish.yml` is already configured in npm, do not add another publisher.
Just verify the existing one.

The explicit dispatch is intentional. `auto-upstream-release.yml` pushes the tag
with the default `GITHUB_TOKEN`, and GitHub does not start a new `push` workflow
from events created by that token. `workflow_dispatch` is the supported exception.

Go to npm:

1. Open `https://www.npmjs.com/`.
2. Sign in with the account that can manage `gstack-codex`.
3. Open the `gstack-codex` package.
4. Open `Settings`.
5. Find `Trusted publishing`.
6. Open the existing GitHub Actions trusted publisher.

Use these values:

| Field | Value |
|---|---|
| Provider | `GitHub Actions` |
| Organization or user | `phd-peter` |
| Repository | `gstack-codex` |
| Workflow filename | `publish.yml` |
| Environment name | `release` |

Important:

- Do not enter `.github/workflows/publish.yml`.
- The value must be exactly `publish.yml`.
- Do not replace it with `auto-upstream-release.yml`.
- Do not look for an "add another" button. npm does not support a second trusted
  publisher for the same package.

## 2. Configure GitHub `release` Environment Refs

Go to GitHub:

1. Open `https://github.com/phd-peter/gstack-codex`.
2. Open `Settings`.
3. Open `Environments`.
4. Select the `release` environment.
5. Find `Deployment branches and tags`.

Set it to allow:

| Pattern | Why |
|---|---|
| `main` | `publish.yml` is dispatched from `main` by `auto-upstream-release.yml`. |
| `v*` | `publish.yml` runs from release tags. |

If GitHub shows separate branch/tag controls, configure both:

- Branch pattern: `main`
- Tag pattern: `v*`

## 3. Allow GitHub Actions To Push Release Commits And Tags

The automatic release workflow writes back to the repo:

- commits `package.json`
- commits `upstream-gstack.json`
- pushes a `vX.Y.Z` tag

Go to:

1. GitHub repo `Settings`.
2. `Actions`.
3. `General`.
4. `Workflow permissions`.

Set:

- `Read and write permissions`
- Enable `Allow GitHub Actions to create and approve pull requests`

Then check branch protection:

1. GitHub repo `Settings`.
2. `Branches`.
3. Open the rule that protects `main`, if one exists.

Make sure the workflow can push the release bump commit. The exact GitHub UI varies,
but one of these must be true:

- `main` is not protected, or
- GitHub Actions / repository bot is allowed to bypass the rule, or
- the protection rule allows the workflow's required checks and bot push pattern.

If this is not allowed, the workflow will pass tests and packaging, then fail at
`git push origin HEAD:main`.

## 4. Choose Approval Or Fully Automatic Publish

The `release` environment controls whether `publish.yml` is fully automatic.

Go to:

1. GitHub repo `Settings`.
2. `Environments`.
3. `release`.
4. `Deployment protection rules`.

Choose one mode:

### Approval Mode

Keep `Required reviewers` enabled.

Result:

- The workflow detects upstream changes automatically.
- It prepares the release automatically.
- It dispatches `publish.yml`.
- `publish.yml` pauses before npm publish.
- A reviewer must approve.
- After approval, npm publish and GitHub Release asset upload continue.

Use this if you want a human gate before public release.

### Fully Automatic Mode

Remove `Required reviewers`.

Result:

- Weekly upstream check runs.
- If upstream changed, the workflow publishes without waiting.
- npm and GitHub Release update automatically.

Use this only if you are comfortable letting tests and smoke builds decide whether
an upstream update is safe to publish.

## Quick Verification

After settings are done:

1. Open GitHub `Actions`.
2. Select `auto-upstream-release`.
3. Click `Run workflow`.
4. Leave `force` off for a normal check.
5. Use `force=true` only when testing the full release path intentionally.

Expected behavior:

- If upstream has not changed and `force=false`, the workflow exits after detection.
- If upstream changed, it creates a patch release commit and tag.
- It then dispatches `publish.yml`.
- If approval mode is enabled, `publish.yml` waits at the `release` environment.
