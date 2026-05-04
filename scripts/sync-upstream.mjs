import fs from 'fs';
import path from 'path';
import { PACKAGE_ROOT } from '../src/paths.js';
import { prepareUpstreamCheckout, readLatestUpstreamCommit } from '../src/upstream-bootstrap.js';
import { readUpstreamConfig, writeUpstreamConfig } from '../src/upstream-config.js';

function parseArgs(argv) {
  return {
    write: argv.includes('--write'),
    force: argv.includes('--force'),
  };
}

function appendGitHubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

const options = parseArgs(process.argv.slice(2));
const current = readUpstreamConfig(PACKAGE_ROOT);
const latest = readLatestUpstreamCommit({ packageRoot: PACKAGE_ROOT });
const changed = latest.commit !== current.pinned_commit;
const shouldContinue = changed || options.force;
const compareUrl = `${current.repo_url.replace(/\.git$/, '')}/compare/${current.pinned_commit}...${latest.commit}`;

if (!shouldContinue) {
  console.log(`No upstream change detected for ${current.repo_url} ${current.branch}.`);
  console.log(`- pinned commit: ${current.pinned_commit}`);
  appendGitHubOutput({
    changed: 'false',
    upstream_changed: 'false',
    previous_commit: current.pinned_commit,
    previous_version: current.pinned_version,
    pinned_commit: current.pinned_commit,
    pinned_version: current.pinned_version,
    compare_url: compareUrl,
  });
  process.exit(0);
}

const prepared = prepareUpstreamCheckout({
  packageRoot: PACKAGE_ROOT,
  cacheDir: path.join(PACKAGE_ROOT, 'dist', '.sync-upstream', 'gstack'),
  refMode: 'latest',
});

const nextConfig = {
  ...current,
  pinned_commit: prepared.commit,
  pinned_version: prepared.version,
};

if (options.write) {
  writeUpstreamConfig(nextConfig, PACKAGE_ROOT);
}

console.log(`Resolved latest upstream gstack ${prepared.version} (${prepared.commit}).`);
console.log(`- previous commit: ${current.pinned_commit}`);
console.log(`- previous version: ${current.pinned_version}`);
console.log(`- compare: ${compareUrl}`);
console.log(`- write: ${options.write ? 'yes' : 'no'}`);

appendGitHubOutput({
  changed: String(shouldContinue),
  upstream_changed: String(changed),
  previous_commit: current.pinned_commit,
  previous_version: current.pinned_version,
  pinned_commit: prepared.commit,
  pinned_version: prepared.version,
  compare_url: `${current.repo_url.replace(/\.git$/, '')}/compare/${current.pinned_commit}...${prepared.commit}`,
});
