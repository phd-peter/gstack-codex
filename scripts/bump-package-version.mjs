import fs from 'fs';
import path from 'path';
import { PACKAGE_ROOT } from '../src/paths.js';
import { readPackageManifest } from '../src/package-metadata.js';
import { bumpPatchVersion, writePackageVersion } from '../src/version.js';

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    patch: argv.includes('--patch') || argv.length === 0,
  };
}

function appendGitHubOutput(values) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

const options = parseArgs(process.argv.slice(2));
if (!options.patch) {
  throw new Error('Only --patch auto-bumps are supported.');
}

const current = readPackageManifest(PACKAGE_ROOT);
const nextVersion = bumpPatchVersion(current.version);

if (!options.dryRun) {
  writePackageVersion({
    packageRoot: PACKAGE_ROOT,
    version: nextVersion,
  });
}

const tag = `v${nextVersion}`;
const tarball = `${current.name}-${nextVersion}.tgz`;

console.log(`Package version: ${current.version} -> ${nextVersion}`);
console.log(`Release tag: ${tag}`);
console.log(`Dry run: ${options.dryRun ? 'yes' : 'no'}`);

appendGitHubOutput({
  previous_version: current.version,
  version: nextVersion,
  tag,
  package: current.name,
  tarball,
  package_json: path.relative(PACKAGE_ROOT, path.join(PACKAGE_ROOT, 'package.json')).split(path.sep).join('/'),
});

