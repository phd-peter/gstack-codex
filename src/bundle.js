import fs from 'fs';
import path from 'path';
import { BUNDLE_SCHEMA_VERSION } from './constants.js';
import { hashDirectorySync, pathExistsSync } from './fs.js';

export function loadBundle(bundleRoot) {
  const manifestPath = path.join(bundleRoot, 'manifest.json');
  if (!pathExistsSync(manifestPath)) {
    throw new Error(`Release bundle not found at ${bundleRoot}. Run \`npm run build:release\` first, or install from a published package that already includes bundle/current.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema_version !== BUNDLE_SCHEMA_VERSION) {
    throw new Error(`Unsupported bundle schema: ${manifest.schema_version}`);
  }

  return { root: bundleRoot, manifest };
}

export function getPack(bundle, packName) {
  const key = packName === 'core' ? 'core_pack' : 'full_pack';
  const pack = bundle.manifest[key];
  if (!pack) {
    throw new Error(`Bundle is missing ${key}.`);
  }
  return pack;
}

export function resolvePackSkillRoot(bundle, packName) {
  return path.join(bundle.root, getPack(bundle, packName).skill_root);
}

export function resolvePackRuntimeRoot(bundle, packName) {
  return path.join(bundle.root, getPack(bundle, packName).runtime_root);
}

export function verifyPackIntegrity(bundle, packName) {
  const pack = getPack(bundle, packName);
  const skillRoot = resolvePackSkillRoot(bundle, packName);
  const runtimeRoot = resolvePackRuntimeRoot(bundle, packName);

  if (!pathExistsSync(skillRoot)) {
    throw new Error(`Bundle is incomplete. Missing ${packName} skill root: ${skillRoot}`);
  }
  if (!pathExistsSync(runtimeRoot)) {
    throw new Error(`Bundle is incomplete. Missing ${packName} runtime root: ${runtimeRoot}`);
  }

  const skillHash = hashDirectorySync(skillRoot);
  const runtimeHash = hashDirectorySync(runtimeRoot);

  if (pack.skill_root_sha256 && skillHash !== pack.skill_root_sha256) {
    throw new Error(`Bundle integrity check failed for ${packName} skill root.`);
  }
  if (pack.runtime_root_sha256 && runtimeHash !== pack.runtime_root_sha256) {
    throw new Error(`Bundle integrity check failed for ${packName} runtime root.`);
  }
}
