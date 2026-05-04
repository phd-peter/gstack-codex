import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { BUNDLE_SCHEMA_VERSION, CORE_PACK_SKILLS } from './constants.js';

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function assertPath(target, label, errors) {
  if (!fs.existsSync(target)) {
    errors.push(`Missing ${label}: ${target}`);
  }
}

function listTarball(tarballPath) {
  const result = spawnSync('tar', ['-tf', tarballPath], {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'tar command failed').trim());
  }

  return result.stdout.split(/\r?\n/).filter(Boolean);
}

export function checkReleaseCompatibility({
  packageRoot,
  releaseRoot,
  bundleRoot = path.join(packageRoot, 'bundle', 'current'),
  requireTarball = false,
} = {}) {
  const errors = [];
  const warnings = [];
  const manifestPath = path.join(bundleRoot, 'manifest.json');
  const releaseManifestPath = path.join(releaseRoot, 'release.json');

  assertPath(manifestPath, 'bundle manifest', errors);
  assertPath(releaseManifestPath, 'release manifest', errors);

  if (errors.length) {
    return { ok: false, errors, warnings };
  }

  const manifest = readJson(manifestPath);
  const releaseManifest = readJson(releaseManifestPath);
  const coreSkills = manifest.core_pack?.skills ?? [];
  const fullSkills = manifest.full_pack?.skills ?? [];
  const runtimeRoot = manifest.core_pack?.runtime_root;

  if (manifest.schema_version !== BUNDLE_SCHEMA_VERSION) {
    errors.push(`Unsupported bundle schema ${manifest.schema_version}. Expected ${BUNDLE_SCHEMA_VERSION}.`);
  }
  for (const skill of CORE_PACK_SKILLS) {
    if (!coreSkills.includes(skill)) {
      errors.push(`Core pack is missing required skill ${skill}.`);
    }
  }
  if (fullSkills.length < coreSkills.length) {
    errors.push(`Full pack has fewer skills (${fullSkills.length}) than core pack (${coreSkills.length}).`);
  }

  for (const skill of coreSkills) {
    assertPath(path.join(bundleRoot, manifest.core_pack.skill_root, skill, 'SKILL.md'), `core skill ${skill}`, errors);
  }
  for (const skill of fullSkills) {
    assertPath(path.join(bundleRoot, manifest.full_pack.skill_root, skill, 'SKILL.md'), `full skill ${skill}`, errors);
  }
  if (runtimeRoot) {
    assertPath(path.join(bundleRoot, runtimeRoot, 'SKILL.md'), 'runtime SKILL.md', errors);
  } else {
    errors.push('Manifest is missing core_pack.runtime_root.');
  }

  if (releaseManifest.bundle?.upstream?.commit !== manifest.upstream?.commit) {
    errors.push('Release manifest upstream commit does not match bundle manifest upstream commit.');
  }
  if (releaseManifest.bundle?.core_skill_count !== coreSkills.length) {
    errors.push('Release manifest core skill count does not match bundle manifest.');
  }
  if (releaseManifest.bundle?.full_skill_count !== fullSkills.length) {
    errors.push('Release manifest full skill count does not match bundle manifest.');
  }

  if (requireTarball) {
    const tarballRelativePath = releaseManifest.npm_artifact?.path;
    if (!tarballRelativePath) {
      errors.push('Release manifest does not include npm_artifact.path.');
    } else {
      const tarballPath = path.join(releaseRoot, tarballRelativePath);
      assertPath(tarballPath, 'npm tarball', errors);
      if (fs.existsSync(tarballPath)) {
        const tarballFiles = new Set(listTarball(tarballPath));
        const requiredTarballFiles = [
          'package/bundle/current/manifest.json',
          'package/bundle/current/packs/runtime/gstack/SKILL.md',
          'package/bundle/current/packs/core/skills/gstack-ship/SKILL.md',
        ];
        for (const requiredFile of requiredTarballFiles) {
          if (!tarballFiles.has(requiredFile)) {
            errors.push(`npm tarball is missing ${requiredFile}.`);
          }
        }
      }
    }
  } else if (!releaseManifest.npm_artifact?.path) {
    warnings.push('npm artifact has not been recorded yet.');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      upstream: manifest.upstream,
      core_skill_count: coreSkills.length,
      full_skill_count: fullSkills.length,
      schema_version: manifest.schema_version,
    },
  };
}
