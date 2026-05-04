import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bumpPatchVersion, writePackageVersion } from '../src/version.js';

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('package version helpers', () => {
  test('bumps patch versions', () => {
    expect(bumpPatchVersion('0.2.0')).toBe('0.2.1');
    expect(bumpPatchVersion('1.9.99')).toBe('1.9.100');
  });

  test('rejects prerelease versions for automatic patch releases', () => {
    expect(() => bumpPatchVersion('1.0.0-beta.1')).toThrow('unsupported package version');
  });

  test('writes the package version without changing package identity', () => {
    const root = tempDir('gstack-codex-version-');

    try {
      fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify({
        name: 'gstack-codex',
        version: '0.2.0',
      }, null, 2)}\n`, 'utf8');

      const result = writePackageVersion({
        packageRoot: root,
        version: '0.2.1',
      });

      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(result.previousVersion).toBe('0.2.0');
      expect(result.version).toBe('0.2.1');
      expect(result.packageName).toBe('gstack-codex');
      expect(manifest).toEqual({
        name: 'gstack-codex',
        version: '0.2.1',
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

