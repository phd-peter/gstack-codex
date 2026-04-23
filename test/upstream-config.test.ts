import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PACKAGE_NAME } from '../src/constants.js';
import { assertPreparedVendoredRoot, resolveReleaseVendoredRoot } from '../src/upstream-source.js';
import { readUpstreamConfig, writeUpstreamConfig } from '../src/upstream-config.js';

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('upstream gstack config', () => {
  test('writes and reads the tracked upstream pin', () => {
    const root = tempDir(`${PACKAGE_NAME}-upstream-config-`);

    try {
      writeUpstreamConfig({
        repo_url: 'https://github.com/garrytan/gstack.git',
        branch: 'main',
        generated_host: 'codex',
        pinned_version: '1.5.1.0',
        pinned_commit: 'deadbeef',
      }, root);

      expect(readUpstreamConfig(root)).toEqual({
        repo_url: 'https://github.com/garrytan/gstack.git',
        branch: 'main',
        generated_host: 'codex',
        pinned_version: '1.5.1.0',
        pinned_commit: 'deadbeef',
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('release source resolution prefers an explicit override root', () => {
    const root = tempDir(`${PACKAGE_NAME}-upstream-source-`);
    const overrideRoot = path.join(root, 'prepared-upstream');

    try {
      expect(resolveReleaseVendoredRoot({
        packageRoot: root,
        overrideRoot,
      })).toBe(overrideRoot);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('prepared upstream root must include generated Codex skill docs', () => {
    const root = tempDir(`${PACKAGE_NAME}-prepared-upstream-`);

    try {
      expect(() => assertPreparedVendoredRoot(root)).toThrow('Missing prepared upstream gstack checkout');

      fs.mkdirSync(path.join(root, '.agents', 'skills'), { recursive: true });
      expect(assertPreparedVendoredRoot(root)).toBe(root);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
