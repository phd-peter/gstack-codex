import fs from 'fs';
import path from 'path';
import { writeJsonSync } from './fs.js';
import { PACKAGE_ROOT } from './paths.js';

export function bumpPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Cannot auto-bump unsupported package version: ${version}`);
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

export function writePackageVersion({
  packageRoot = PACKAGE_ROOT,
  version,
} = {}) {
  if (!version) {
    throw new Error('Missing package version to write.');
  }

  const packageJsonPath = path.join(packageRoot, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const previousVersion = manifest.version;
  manifest.version = version;
  writeJsonSync(packageJsonPath, manifest);

  return {
    packageJsonPath,
    previousVersion,
    version,
    packageName: manifest.name,
  };
}

