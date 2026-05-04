import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  buildUpstreamDiffReport,
  renderUpstreamDiffReportMarkdown,
} from '../src/upstream-diff-report.js';

function tempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return (result.stdout || '').trim();
}

function writeFile(target: string, content: string) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

describe('upstream diff report', () => {
  test('summarizes commits and changed files by category', () => {
    const root = tempDir('gstack-codex-upstream-report-');

    try {
      run('git', ['init'], root);
      run('git', ['config', 'user.name', 'Test User'], root);
      run('git', ['config', 'user.email', 'test@example.com'], root);
      writeFile(path.join(root, 'README.md'), '# upstream\n');
      run('git', ['add', '.'], root);
      run('git', ['commit', '-m', 'initial'], root);
      const previous = run('git', ['rev-parse', 'HEAD'], root);

      writeFile(path.join(root, 'skills', 'gstack-ship', 'SKILL.md'), '# ship\n');
      writeFile(path.join(root, 'bin', 'gstack-update-check'), 'echo ok\n');
      run('git', ['add', '.'], root);
      run('git', ['commit', '-m', 'add ship skill'], root);
      const current = run('git', ['rev-parse', 'HEAD'], root);

      const report = buildUpstreamDiffReport({
        upstreamRoot: root,
        previousCommit: previous,
        currentCommit: current,
        repoUrl: 'https://github.com/example/upstream.git',
        generatedAt: '2026-05-04T00:00:00.000Z',
      });

      expect(report.counts.commits).toBe(1);
      expect(report.counts.files_changed).toBe(2);
      expect(report.counts.by_category.skill).toBe(1);
      expect(report.counts.by_category.runtime).toBe(1);

      const markdown = renderUpstreamDiffReportMarkdown(report);
      expect(markdown).toContain('Upstream Diff Report');
      expect(markdown).toContain('skills/gstack-ship/SKILL.md');
      expect(markdown).toContain('https://github.com/example/upstream/compare/');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
