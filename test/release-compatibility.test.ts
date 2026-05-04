import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkReleaseCompatibility } from '../src/release-compatibility.js';

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(target: string, content: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function createBundle(root: string) {
  const bundleRoot = path.join(root, 'bundle', 'current');
  const releaseRoot = path.join(root, 'dist', 'releases', '0.2.0-test');
  const coreSkills = [
    'gstack-upgrade',
    'gstack-office-hours',
    'gstack-plan-ceo-review',
    'gstack-plan-eng-review',
    'gstack-review',
    'gstack-ship',
  ];
  const fullSkills = [...coreSkills, 'gstack-autoplan'];

  for (const skill of coreSkills) {
    writeFile(path.join(bundleRoot, 'packs', 'core', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  for (const skill of fullSkills) {
    writeFile(path.join(bundleRoot, 'packs', 'full', 'skills', skill, 'SKILL.md'), `# ${skill}\n`);
  }
  writeFile(path.join(bundleRoot, 'packs', 'runtime', 'gstack', 'SKILL.md'), '# runtime\n');

  const manifest = {
    schema_version: 1,
    version: '0.2.0-test',
    upstream: {
      version: '1.6.1.0',
      commit: 'abc123',
    },
    core_pack: {
      skills: coreSkills,
      skill_root: 'packs/core/skills',
      runtime_root: 'packs/runtime/gstack',
    },
    full_pack: {
      skills: fullSkills,
      skill_root: 'packs/full/skills',
      runtime_root: 'packs/runtime/gstack',
    },
  };
  const release = {
    version: '0.2.0-test',
    bundle: {
      upstream: manifest.upstream,
      core_skill_count: coreSkills.length,
      full_skill_count: fullSkills.length,
    },
    npm_artifact: null,
  };

  writeFile(path.join(bundleRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFile(path.join(releaseRoot, 'release.json'), `${JSON.stringify(release, null, 2)}\n`);

  return { bundleRoot, releaseRoot };
}

describe('release compatibility gate', () => {
  test('accepts a release bundle that matches the release manifest', () => {
    const root = tempDir('gstack-codex-compat-');

    try {
      const { bundleRoot, releaseRoot } = createBundle(root);
      const result = checkReleaseCompatibility({
        packageRoot: root,
        releaseRoot,
        bundleRoot,
      });

      expect(result.ok).toBe(true);
      expect(result.summary?.core_skill_count).toBe(6);
      expect(result.summary?.full_skill_count).toBe(7);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('rejects a release bundle missing a required core skill', () => {
    const root = tempDir('gstack-codex-compat-');

    try {
      const { bundleRoot, releaseRoot } = createBundle(root);
      fs.rmSync(path.join(bundleRoot, 'packs', 'core', 'skills', 'gstack-ship'), {
        recursive: true,
        force: true,
      });

      const result = checkReleaseCompatibility({
        packageRoot: root,
        releaseRoot,
        bundleRoot,
      });

      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain('core skill gstack-ship');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
