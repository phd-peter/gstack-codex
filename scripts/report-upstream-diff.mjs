import fs from 'fs';
import path from 'path';
import { PACKAGE_ROOT } from '../src/paths.js';
import { readUpstreamConfig } from '../src/upstream-config.js';
import {
  buildUpstreamDiffReport,
  renderUpstreamDiffReportMarkdown,
} from '../src/upstream-diff-report.js';

function parseArgs(argv) {
  const options = {
    upstreamRoot: process.env.GSTACK_CODEX_UPSTREAM_ROOT || path.join(PACKAGE_ROOT, 'dist', '.sync-upstream', 'gstack'),
    previousCommit: process.env.GSTACK_CODEX_PREVIOUS_UPSTREAM_COMMIT || null,
    currentCommit: process.env.GSTACK_CODEX_CURRENT_UPSTREAM_COMMIT || null,
    output: path.join(PACKAGE_ROOT, 'dist', 'upstream-diff-report.md'),
    jsonOutput: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--upstream-root') {
      options.upstreamRoot = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--previous') {
      options.previousCommit = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--current') {
      options.currentCommit = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--json-output') {
      options.jsonOutput = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const config = readUpstreamConfig(PACKAGE_ROOT);
const report = buildUpstreamDiffReport({
  upstreamRoot: options.upstreamRoot,
  previousCommit: options.previousCommit,
  currentCommit: options.currentCommit,
  repoUrl: config.repo_url,
});

fs.mkdirSync(path.dirname(options.output), { recursive: true });
fs.writeFileSync(options.output, renderUpstreamDiffReportMarkdown(report), 'utf8');

if (options.jsonOutput) {
  fs.mkdirSync(path.dirname(options.jsonOutput), { recursive: true });
  fs.writeFileSync(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`Wrote upstream diff report to ${options.output}`);
console.log(`- commits: ${report.counts.commits}`);
console.log(`- files changed: ${report.counts.files_changed}`);

const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  const categorySummary = Object.entries(report.counts.by_category)
    .map(([category, count]) => `${category}:${count}`)
    .join(', ');
  fs.appendFileSync(githubOutput, [
    `report_path=${options.output}`,
    `commits=${report.counts.commits}`,
    `files_changed=${report.counts.files_changed}`,
    `categories=${categorySummary}`,
  ].join('\n') + '\n', 'utf8');
}
