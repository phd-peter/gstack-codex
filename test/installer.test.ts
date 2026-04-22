import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MANAGED_BLOCK_END, MANAGED_BLOCK_START } from '../src/constants.js';
import { installGlobal } from '../src/install-global.js';
import { installProject } from '../src/install-project.js';
import { applyManagedBlock, renderManagedBlock } from '../src/managed-block.js';
import { runGlobalPreflight } from '../src/preflight.js';

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(target: string, content: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function countManagedBlocks(content: string) {
  return content.split(MANAGED_BLOCK_START).length - 1;
}

function createFixtureBundle() {
  const root = tempDir('gstack-codex-bundle-');
  const coreSkillRoot = path.join(root, 'packs', 'core', 'skills');
  const coreRuntimeRoot = path.join(root, 'packs', 'core', 'runtime', 'gstack');
  const fullSkillRoot = path.join(root, 'packs', 'full', 'skills');
  const fullRuntimeRoot = path.join(root, 'packs', 'full', 'runtime', 'gstack');

  const coreSkills = [
    'gstack-upgrade',
    'gstack-office-hours',
    'gstack-plan-ceo-review',
    'gstack-plan-eng-review',
    'gstack-review',
    'gstack-ship',
  ];

  const fullSkills = [...coreSkills, 'gstack-browse'];

  const commandNameForSkill = (skill: string) => (
    skill === 'gstack-upgrade'
      ? 'gstack-upgrade'
      : skill.replace(/^gstack-/, '')
  );

  const skillDoc = (skill: string) => `---
name: ${commandNameForSkill(skill)}
description: |
  ${commandNameForSkill(skill)} description.
---

# ${skill}
`;

  for (const skill of coreSkills) {
    writeFile(path.join(coreSkillRoot, skill, 'SKILL.md'), skillDoc(skill));
  }
  for (const skill of fullSkills) {
    writeFile(path.join(fullSkillRoot, skill, 'SKILL.md'), skillDoc(skill));
  }

  for (const runtimeRoot of [coreRuntimeRoot, fullRuntimeRoot]) {
    writeFile(path.join(runtimeRoot, 'SKILL.md'), '# gstack runtime\n');
    writeFile(path.join(runtimeRoot, 'bin', 'gstack-update-check'), '#!/usr/bin/env bash\necho OK\n');
    writeFile(path.join(runtimeRoot, 'review', 'checklist.md'), 'review checklist\n');
    writeFile(path.join(runtimeRoot, 'review', 'specialists', 'testing.md'), 'testing specialist\n');
    writeFile(path.join(runtimeRoot, 'qa', 'templates', 'default.md'), 'qa template\n');
    writeFile(path.join(runtimeRoot, 'ETHOS.md'), 'ethos\n');
  }

  const manifest = {
    schema_version: 1,
    version: '0.1.0-test',
    upstream: {
      version: '1.5.1.0',
      commit: 'deadbeefcafebabe',
    },
    core_pack: {
      skills: coreSkills,
      skill_root: 'packs/core/skills',
      runtime_root: 'packs/core/runtime/gstack',
    },
    full_pack: {
      skills: fullSkills,
      skill_root: 'packs/full/skills',
      runtime_root: 'packs/full/runtime/gstack',
    },
  };

  writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, coreSkills, fullSkills };
}

describe('managed block utility', () => {
  test('creates a new file when AGENTS.md is empty', () => {
    const block = renderManagedBlock({
      scope: 'global',
      manifest: {
        version: '0.1.0-test',
        upstream: { version: '1.0.0', commit: 'abc123' },
      },
      skillsPath: '$HOME/.agents/skills',
    });
    const result = applyManagedBlock('', block);
    expect(result.mode).toBe('created');
    expect(result.content).toContain(MANAGED_BLOCK_START);
    expect(result.content).toContain(MANAGED_BLOCK_END);
  });

  test('replaces only the managed block when AGENTS.md already contains one', () => {
    const original = [
      '# User content',
      '',
      `${MANAGED_BLOCK_START}`,
      'old block',
      `${MANAGED_BLOCK_END}`,
      '',
      'keep me',
    ].join('\n');

    const block = renderManagedBlock({
      scope: 'project',
      manifest: {
        version: '0.1.0-test',
        upstream: { version: '1.0.0', commit: 'abc123' },
      },
      skillsPath: '.agents/skills',
    });

    const result = applyManagedBlock(original, block);
    expect(result.mode).toBe('replaced');
    expect(result.content).toContain('# User content');
    expect(result.content).toContain('keep me');
    expect(countManagedBlocks(result.content)).toBe(1);
  });
});

describe('global install', () => {
  test('global preflight accepts a Windows codex.cmd shim', () => {
    if (process.platform !== 'win32') return;

    const home = tempDir('gstack-codex-home-');
    const binDir = path.join(home, 'bin');
    const codexCmdBase = path.join(binDir, 'codex');

    try {
      writeFile(path.join(home, '.codex', 'auth.json'), '{}');
      writeFile(`${codexCmdBase}.cmd`, '@echo off\r\necho codex-cli 0.122.0\r\n');

      const result = runGlobalPreflight({
        homeDir: home,
        codexBin: codexCmdBase,
      });

      expect(result.parsedVersion).toBe('0.122.0');
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('global preflight resolves codex.cmd from PATH on Windows', () => {
    if (process.platform !== 'win32') return;

    const home = tempDir('gstack-codex-home-');
    const binDir = path.join(home, 'bin');
    const originalPath = process.env.PATH;

    try {
      writeFile(path.join(home, '.codex', 'auth.json'), '{}');
      writeFile(path.join(binDir, 'codex.cmd'), '@echo off\r\necho codex-cli 0.122.0\r\n');
      process.env.PATH = `${binDir};${originalPath ?? ''}`;

      const result = runGlobalPreflight({
        homeDir: home,
      });

      expect(result.parsedVersion).toBe('0.122.0');
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('installs core pack and updates ~/.codex/AGENTS.md idempotently', () => {
    const bundle = createFixtureBundle();
    const home = tempDir('gstack-codex-home-');

    try {
      installGlobal({
        bundleRoot: bundle.root,
        homeDir: home,
        skipPreflight: true,
      });

      const agentsFile = path.join(home, '.codex', 'AGENTS.md');
      const installState = path.join(home, '.codex', 'gstack-codex', 'install-state.json');
      const agentsContent = fs.readFileSync(agentsFile, 'utf8');
      expect(countManagedBlocks(agentsContent)).toBe(1);
      expect(agentsContent).toContain('## gstack — AI Engineering Workflow');
      expect(agentsContent).toContain('| `/office-hours` | office-hours description.');
      expect(agentsContent).toContain('| `/gstack-upgrade` | gstack-upgrade description.');
      expect(agentsContent).not.toContain('/browse');
      expect(fs.existsSync(installState)).toBe(true);

      for (const skill of bundle.coreSkills) {
        expect(fs.existsSync(path.join(home, '.agents', 'skills', skill, 'SKILL.md'))).toBe(true);
      }
      expect(fs.existsSync(path.join(home, '.agents', 'skills', 'gstack', 'review', 'specialists', 'testing.md'))).toBe(true);

      installGlobal({
        bundleRoot: bundle.root,
        homeDir: home,
        skipPreflight: true,
      });

      const rerunContent = fs.readFileSync(agentsFile, 'utf8');
      expect(countManagedBlocks(rerunContent)).toBe(1);
    } finally {
      fs.rmSync(bundle.root, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('rolls back AGENTS.md when global install fails mid-flight', () => {
    const bundle = createFixtureBundle();
    const home = tempDir('gstack-codex-home-');
    const agentsFile = path.join(home, '.codex', 'AGENTS.md');

    try {
      writeFile(agentsFile, '# Existing AGENTS\n');

      expect(() => installGlobal({
        bundleRoot: bundle.root,
        homeDir: home,
        skipPreflight: true,
        failAfterStep: 'global-agents',
      })).toThrow('Injected failure');

      const agentsContent = fs.readFileSync(agentsFile, 'utf8');
      expect(agentsContent).toBe('# Existing AGENTS\n');
      expect(fs.existsSync(path.join(home, '.agents', 'skills', 'gstack'))).toBe(false);
    } finally {
      fs.rmSync(bundle.root, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('migrates legacy ~/.codex/skills/gstack into a backup before installing the new global runtime', () => {
    const bundle = createFixtureBundle();
    const home = tempDir('gstack-codex-home-');
    const legacyRoot = path.join(home, '.codex', 'skills', 'gstack');

    try {
      writeFile(path.join(legacyRoot, 'SKILL.md'), '# legacy runtime\n');

      installGlobal({
        bundleRoot: bundle.root,
        homeDir: home,
        skipPreflight: true,
      });

      const state = JSON.parse(fs.readFileSync(path.join(home, '.codex', 'gstack-codex', 'install-state.json'), 'utf8'));
      expect(state.legacy_backup_path).toBeTruthy();
      expect(fs.existsSync(legacyRoot)).toBe(false);
      expect(fs.existsSync(state.legacy_backup_path)).toBe(true);
      expect(fs.readFileSync(path.join(state.legacy_backup_path, 'SKILL.md'), 'utf8')).toContain('legacy runtime');
      expect(fs.existsSync(path.join(home, '.agents', 'skills', 'gstack', 'SKILL.md'))).toBe(true);
    } finally {
      fs.rmSync(bundle.root, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  test('refuses to overwrite unmanaged global skill directories', () => {
    const bundle = createFixtureBundle();
    const home = tempDir('gstack-codex-home-');

    try {
      writeFile(path.join(home, '.agents', 'skills', 'gstack-review', 'SKILL.md'), '# user-owned\n');

      expect(() => installGlobal({
        bundleRoot: bundle.root,
        homeDir: home,
        skipPreflight: true,
      })).toThrow('not managed by gstack-codex');
    } finally {
      fs.rmSync(bundle.root, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});

describe('project install', () => {
  test('installs full pack into repo and appends one managed block', () => {
    const bundle = createFixtureBundle();
    const repo = tempDir('gstack-codex-repo-');

    try {
      fs.mkdirSync(path.join(repo, '.git'));
      writeFile(path.join(repo, 'AGENTS.md'), '# Project notes\n');

      installProject({
        bundleRoot: bundle.root,
        repoRoot: repo,
      });

      const agentsContent = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(agentsContent).toContain('# Project notes');
      expect(countManagedBlocks(agentsContent)).toBe(1);
      expect(agentsContent).toContain('| `/browse` | browse description.');
      expect(agentsContent).toContain('Repo installs include the full generated skill pack.');

      for (const skill of bundle.fullSkills) {
        expect(fs.existsSync(path.join(repo, '.agents', 'skills', skill, 'SKILL.md'))).toBe(true);
      }

      expect(fs.existsSync(path.join(repo, '.agents', 'skills', 'gstack', 'bin', 'gstack-update-check'))).toBe(true);
      expect(fs.existsSync(path.join(repo, '.agents', 'skills', '.gstack-codex-manifest.json'))).toBe(true);

      installProject({
        bundleRoot: bundle.root,
        repoRoot: repo,
      });

      const rerunContent = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
      expect(countManagedBlocks(rerunContent)).toBe(1);
    } finally {
      fs.rmSync(bundle.root, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  test('refuses to overwrite unmanaged repo-local skill directories', () => {
    const bundle = createFixtureBundle();
    const repo = tempDir('gstack-codex-repo-');

    try {
      fs.mkdirSync(path.join(repo, '.git'));
      writeFile(path.join(repo, '.agents', 'skills', 'gstack-browse', 'SKILL.md'), '# user-owned\n');

      expect(() => installProject({
        bundleRoot: bundle.root,
        repoRoot: repo,
      })).toThrow('not managed by gstack-codex');
    } finally {
      fs.rmSync(bundle.root, { recursive: true, force: true });
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
