import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

function runGit(args, { cwd }) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'git command failed').trim());
  }

  return (result.stdout || '').trim();
}

function parseNameStatusLine(line) {
  const parts = line.split('\t');
  const status = parts[0];
  return {
    status,
    path: parts[parts.length - 1],
    previousPath: parts.length > 2 ? parts[1] : null,
  };
}

function classifyPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('SKILL.md') || normalized.includes('/skills/') || normalized.startsWith('skills/')) {
    return 'skill';
  }
  if (
    normalized.startsWith('bin/')
    || normalized.startsWith('browse/')
    || normalized.startsWith('design/')
    || normalized.startsWith('scripts/')
    || normalized.startsWith('src/')
    || normalized.includes('/bin/')
  ) {
    return 'runtime';
  }
  if (
    normalized.startsWith('docs/')
    || normalized.endsWith('.md')
    || normalized === 'README.md'
    || normalized === 'CHANGELOG.md'
  ) {
    return 'docs';
  }
  if (
    normalized === 'package.json'
    || normalized.endsWith('lock')
    || normalized.endsWith('.lockb')
    || normalized.endsWith('.toml')
    || normalized.endsWith('.json')
  ) {
    return 'metadata';
  }
  return 'other';
}

function statusLabel(status) {
  if (status.startsWith('A')) return 'added';
  if (status.startsWith('D')) return 'removed';
  if (status.startsWith('R')) return 'renamed';
  if (status.startsWith('C')) return 'copied';
  if (status.startsWith('M')) return 'modified';
  return status.toLowerCase();
}

function countBy(entries, keyFn) {
  const counts = new Map();
  for (const entry of entries) {
    const key = keyFn(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function renderList(items, emptyText) {
  if (items.length === 0) return `- ${emptyText}`;
  return items.map(item => `- ${item}`).join('\n');
}

export function buildUpstreamDiffReport({
  upstreamRoot,
  previousCommit,
  currentCommit,
  repoUrl = 'https://github.com/garrytan/gstack',
  generatedAt = new Date().toISOString(),
} = {}) {
  if (!upstreamRoot || !fs.existsSync(path.join(upstreamRoot, '.git'))) {
    throw new Error(`Missing upstream git checkout at ${upstreamRoot}.`);
  }
  if (!previousCommit || !currentCommit) {
    throw new Error('Both previousCommit and currentCommit are required.');
  }

  const range = `${previousCommit}...${currentCommit}`;
  const diffOutput = runGit(['diff', '--name-status', range], { cwd: upstreamRoot });
  const logOutput = runGit(['log', '--oneline', `${previousCommit}..${currentCommit}`], { cwd: upstreamRoot });
  const entries = diffOutput
    ? diffOutput.split(/\r?\n/).filter(Boolean).map(parseNameStatusLine)
    : [];

  const classifiedEntries = entries.map(entry => ({
    ...entry,
    category: classifyPath(entry.path),
    label: statusLabel(entry.status),
  }));

  const countsByCategory = countBy(classifiedEntries, entry => entry.category);
  const countsByStatus = countBy(classifiedEntries, entry => entry.label);
  const commits = logOutput ? logOutput.split(/\r?\n/).filter(Boolean) : [];
  const compareUrl = `${repoUrl.replace(/\.git$/, '')}/compare/${previousCommit}...${currentCommit}`;

  return {
    generated_at: generatedAt,
    previous_commit: previousCommit,
    current_commit: currentCommit,
    compare_url: compareUrl,
    commits,
    files: classifiedEntries,
    counts: {
      files_changed: classifiedEntries.length,
      commits: commits.length,
      by_category: countsByCategory,
      by_status: countsByStatus,
    },
  };
}

export function renderUpstreamDiffReportMarkdown(report) {
  const categoryRows = Object.entries(report.counts.by_category)
    .map(([category, count]) => [category, String(count)]);
  const statusRows = Object.entries(report.counts.by_status)
    .map(([status, count]) => [status, String(count)]);
  const fileRows = report.files.slice(0, 50).map(file => [
    file.label,
    file.category,
    `\`${file.path}\``,
  ]);

  return `# Upstream Diff Report

Generated: ${report.generated_at}

## Range

- Previous: \`${report.previous_commit}\`
- Current: \`${report.current_commit}\`
- Compare: ${report.compare_url}

## Summary

- Commits: ${report.counts.commits}
- Files changed: ${report.counts.files_changed}

## Files By Category

${categoryRows.length ? markdownTable(['Category', 'Files'], categoryRows) : '- No file changes detected.'}

## Files By Status

${statusRows.length ? markdownTable(['Status', 'Files'], statusRows) : '- No file changes detected.'}

## Recent Commits

${renderList(report.commits.slice(0, 20).map(commit => `\`${commit}\``), 'No commits in range.')}

## Changed Files

${fileRows.length ? markdownTable(['Status', 'Category', 'Path'], fileRows) : '- No changed files.'}

${report.files.length > 50 ? `\nOnly the first 50 changed files are shown. Total changed files: ${report.files.length}.\n` : ''}
`;
}
