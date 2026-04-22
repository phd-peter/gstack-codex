# gstack-codex TODO

This is the real next-work list. Start here next time.

## Now

- Run a true clean-machine smoke for `0.1.1`
  - `npx gstack-codex init --global`
  - `npx gstack-codex init --project`
  - verify generated `AGENTS.md`
  - verify `~/.agents/skills` and repo `.agents/skills`
- Add a short release verification section to `README.md`
  - what to run after publish
  - known good expected output
- Check npm install UX once more
  - confirm first-run `npx` prompt is acceptable
  - confirm no stale `E404` from cache/propagation on a fresh machine

## Next

- Verify macOS in real life
  - `init --global`
  - `init --project`
  - check whether packaged runtime assets behave correctly
- Fix platform-specific runtime packaging
  - stop assuming Windows-built artifacts are enough
  - either ship cross-platform assets or make runtime fallbacks explicit
- Add CI coverage for install flows
  - Windows
  - macOS
  - at least one empty-folder `init --project` test path

## Later

- Slim the npm package
  - current tarball is still heavy
  - review which runtime assets must really ship in v1
- Automate weekly upstream sync and release flow
- Evaluate a dedicated `doctor` or `update` command after the install contract is stable
- Revisit non-core/browser-heavy pack strategy after the core install proves stable

## Explicitly Out Of Scope

- Claude compatibility
- `.claude/skills` support as a product contract
