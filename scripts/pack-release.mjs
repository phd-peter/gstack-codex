import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { copyPathSync, ensureDirSync, removePathSync } from '../src/fs.js';
import { PACKAGE_ROOT } from '../src/paths.js';
import { readPackageVersion } from '../src/package-metadata.js';
import { recordPackedArtifact } from '../src/release-artifacts.js';

const releaseVersion = readPackageVersion(PACKAGE_ROOT);
const releaseRoot = path.join(PACKAGE_ROOT, 'dist', 'releases', releaseVersion);
const stagingOutputRoot = path.join(PACKAGE_ROOT, 'dist', '.npm-pack', releaseVersion);
removePathSync(stagingOutputRoot);
ensureDirSync(stagingOutputRoot);

function parsePackJson(output) {
  const trimmed = (output || '').trim();
  if (!trimmed) {
    throw new Error('npm pack returned no output.');
  }

  const starts = [];
  for (let index = 0; index < trimmed.length; index += 1) {
    if (trimmed[index] === '[') starts.push(index);
  }

  for (let index = starts.length - 1; index >= 0; index -= 1) {
    const candidate = trimmed.slice(starts[index]);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed[0]?.filename) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Could not parse npm pack JSON output.\n${trimmed}`);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packed = spawnSync(
  npmCommand,
  ['pack', '--json', '--pack-destination', stagingOutputRoot],
  {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  },
);

if (packed.error) {
  throw packed.error;
}

if (packed.status !== 0) {
  throw new Error((packed.stderr || packed.stdout || 'npm pack failed').trim());
}

const packResult = parsePackJson(packed.stdout);
if (!Array.isArray(packResult) || packResult.length === 0 || !packResult[0]?.filename) {
  throw new Error('npm pack did not return a tarball filename.');
}

const stagedTarballPath = path.join(stagingOutputRoot, packResult[0].filename);
if (!fs.existsSync(stagedTarballPath)) {
  throw new Error(`npm pack reported ${stagedTarballPath}, but the file was not created.`);
}

const releaseNpmRoot = path.join(releaseRoot, 'npm');
ensureDirSync(releaseNpmRoot);
const tarballPath = path.join(releaseNpmRoot, packResult[0].filename);
copyPathSync(stagedTarballPath, tarballPath);

const releaseManifest = recordPackedArtifact({
  releaseRoot,
  tarballPath,
  packResult,
});

console.log(`Packed npm artifact at ${tarballPath}`);
console.log(`Updated release manifest for ${releaseManifest.version}`);
