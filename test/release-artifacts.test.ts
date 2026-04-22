import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildReleaseArtifacts, recordPackedArtifact } from '../src/release-artifacts.js';

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(target: string, content: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function createVendoredGstack(root: string) {
  const vendoredRoot = path.join(root, '.agents', 'skills', 'gstack');
  const generatedRoot = path.join(vendoredRoot, '.agents', 'skills');

  writeFile(path.join(root, 'package.json'), JSON.stringify({
    name: 'gstack-codex',
    version: '0.2.0-test',
  }, null, 2));
  writeFile(path.join(vendoredRoot, 'VERSION'), '1.5.1.0\n');
  writeFile(path.join(vendoredRoot, '.git', 'HEAD'), 'deadbeefcafebabe\n');

  const coreSkills = [
    'gstack-upgrade',
    'gstack-office-hours',
    'gstack-plan-ceo-review',
    'gstack-plan-eng-review',
    'gstack-review',
    'gstack-ship',
  ];
  const fullSkills = [...coreSkills, 'gstack-browse'];

  for (const skill of fullSkills) {
    writeFile(path.join(generatedRoot, skill, 'SKILL.md'), `# ${skill}\n`);
  }

  const runtimeRoot = path.join(generatedRoot, 'gstack');
  writeFile(path.join(runtimeRoot, 'SKILL.md'), '# runtime\n');
  writeFile(path.join(runtimeRoot, 'ETHOS.md'), 'ethos\n');
  writeFile(path.join(runtimeRoot, 'bin', 'gstack-update-check'), '#!/usr/bin/env bash\necho ok\n');
  writeFile(path.join(runtimeRoot, 'review', 'checklist.md'), 'review checklist\n');
  writeFile(path.join(runtimeRoot, 'qa', 'templates', 'default.md'), 'qa template\n');

  return { vendoredRoot };
}

describe('release artifacts', () => {
  test('builds a versioned release bundle and stages bundle/current', () => {
    const root = tempDir('gstack-codex-release-');

    try {
      const { vendoredRoot } = createVendoredGstack(root);
      const result = buildReleaseArtifacts({
        packageRoot: root,
        releaseVersion: '0.2.0-test',
        vendoredRoot,
        distRoot: path.join(root, 'dist'),
        bundleCurrentRoot: path.join(root, 'bundle', 'current'),
        createdAt: '2026-04-22T07:00:00.000Z',
      });

      expect(fs.existsSync(path.join(result.releaseRoot, 'bundle', 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'bundle', 'current', 'manifest.json'))).toBe(true);

      const releaseManifest = JSON.parse(fs.readFileSync(path.join(result.releaseRoot, 'release.json'), 'utf8'));
      expect(releaseManifest.version).toBe('0.2.0-test');
      expect(releaseManifest.bundle.core_skill_count).toBe(6);
      expect(releaseManifest.npm_artifact).toBe(null);

      const checksums = fs.readFileSync(path.join(result.releaseRoot, 'SHA256SUMS.txt'), 'utf8');
      expect(checksums).toContain('bundle/manifest.json');
      expect(checksums).toContain('release.json');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('records npm tarball metadata back into the release manifest', () => {
    const root = tempDir('gstack-codex-release-');

    try {
      const { vendoredRoot } = createVendoredGstack(root);
      const result = buildReleaseArtifacts({
        packageRoot: root,
        releaseVersion: '0.2.0-test',
        vendoredRoot,
        distRoot: path.join(root, 'dist'),
        bundleCurrentRoot: path.join(root, 'bundle', 'current'),
        createdAt: '2026-04-22T07:00:00.000Z',
      });

      const tarballPath = path.join(result.releaseRoot, 'npm', 'gstack-codex-0.2.0-test.tgz');
      writeFile(tarballPath, 'tarball-bytes');

      const updated = recordPackedArtifact({
        releaseRoot: result.releaseRoot,
        tarballPath,
        packResult: [{ filename: 'gstack-codex-0.2.0-test.tgz' }],
      });

      expect(updated.npm_artifact?.path).toBe('npm/gstack-codex-0.2.0-test.tgz');
      expect(fs.existsSync(path.join(result.releaseRoot, 'npm', 'pack-result.json'))).toBe(true);

      const checksums = fs.readFileSync(path.join(result.releaseRoot, 'SHA256SUMS.txt'), 'utf8');
      expect(checksums).toContain('npm/gstack-codex-0.2.0-test.tgz');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
