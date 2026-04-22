import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PACKAGE_NAME } from './constants.js';
import { buildBundle } from './bundle-builder.js';
import { copyPathSync, ensureDirSync, removePathSync } from './fs.js';
import { PACKAGE_ROOT } from './paths.js';
import { readPackageVersion } from './package-metadata.js';

function hashFileSync(target) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(target));
  return hash.digest('hex');
}

function renderChecksumLines(entries) {
  return `${entries.map(entry => `${entry.sha256}  ${entry.relativePath}`).join('\n')}\n`;
}

function writeReleaseManifest(target, value) {
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function buildReleaseArtifacts({
  packageRoot = PACKAGE_ROOT,
  releaseVersion = readPackageVersion(packageRoot),
  vendoredRoot = path.join(packageRoot, '.agents', 'skills', 'gstack'),
  distRoot = path.join(packageRoot, 'dist'),
  bundleCurrentRoot = path.join(packageRoot, 'bundle', 'current'),
  createdAt = new Date().toISOString(),
} = {}) {
  const releaseRoot = path.join(distRoot, 'releases', releaseVersion);
  const releaseBundleRoot = path.join(releaseRoot, 'bundle');
  const releaseManifestPath = path.join(releaseRoot, 'release.json');
  const checksumPath = path.join(releaseRoot, 'SHA256SUMS.txt');

  removePathSync(releaseRoot);
  ensureDirSync(path.dirname(releaseRoot));

  const { manifest } = buildBundle({
    vendoredRoot,
    outputRoot: releaseBundleRoot,
    version: releaseVersion,
    createdAt,
  });

  removePathSync(bundleCurrentRoot);
  copyPathSync(releaseBundleRoot, bundleCurrentRoot);

  const releaseManifest = {
    package_name: PACKAGE_NAME,
    version: releaseVersion,
    created_at: createdAt,
    bundle: {
      staged_root: path.relative(packageRoot, bundleCurrentRoot).split(path.sep).join('/'),
      release_root: path.relative(packageRoot, releaseBundleRoot).split(path.sep).join('/'),
      manifest_path: 'bundle/manifest.json',
      upstream: manifest.upstream,
      core_skill_count: manifest.core_pack.skills.length,
      full_skill_count: manifest.full_pack.skills.length,
    },
    npm_artifact: null,
  };

  writeReleaseManifest(releaseManifestPath, releaseManifest);

  const checksumEntries = [
    {
      relativePath: 'bundle/manifest.json',
      sha256: hashFileSync(path.join(releaseBundleRoot, 'manifest.json')),
    },
    {
      relativePath: 'release.json',
      sha256: hashFileSync(releaseManifestPath),
    },
  ];
  fs.writeFileSync(checksumPath, renderChecksumLines(checksumEntries), 'utf8');

  return {
    releaseRoot,
    releaseBundleRoot,
    releaseManifestPath,
    checksumPath,
    bundleCurrentRoot,
    manifest,
    releaseManifest,
  };
}

export function recordPackedArtifact({
  releaseRoot,
  tarballPath,
  packResult,
} = {}) {
  const releaseManifestPath = path.join(releaseRoot, 'release.json');
  if (!fs.existsSync(releaseManifestPath)) {
    throw new Error(`Missing release manifest at ${releaseManifestPath}. Run \`npm run build:release\` first.`);
  }

  const releaseManifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'));
  const tarballStats = fs.statSync(tarballPath);
  releaseManifest.npm_artifact = {
    path: path.relative(releaseRoot, tarballPath).split(path.sep).join('/'),
    size_bytes: tarballStats.size,
    sha256: hashFileSync(tarballPath),
    packed_at: new Date().toISOString(),
  };

  writeReleaseManifest(releaseManifestPath, releaseManifest);

  if (packResult) {
    const packResultPath = path.join(releaseRoot, 'npm', 'pack-result.json');
    ensureDirSync(path.dirname(packResultPath));
    fs.writeFileSync(packResultPath, `${JSON.stringify(packResult, null, 2)}\n`, 'utf8');
  }

  const checksumPath = path.join(releaseRoot, 'SHA256SUMS.txt');
  const checksumEntries = [
    {
      relativePath: 'bundle/manifest.json',
      sha256: hashFileSync(path.join(releaseRoot, 'bundle', 'manifest.json')),
    },
    {
      relativePath: 'release.json',
      sha256: hashFileSync(releaseManifestPath),
    },
    {
      relativePath: path.relative(releaseRoot, tarballPath).split(path.sep).join('/'),
      sha256: hashFileSync(tarballPath),
    },
  ];
  fs.writeFileSync(checksumPath, renderChecksumLines(checksumEntries), 'utf8');

  return releaseManifest;
}
