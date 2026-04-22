import fs from 'fs';
import path from 'path';
import { BUNDLE_SCHEMA_VERSION, CORE_PACK_SKILLS } from './constants.js';
import { copyPathSync, ensureDirSync, hashDirectorySync, removePathSync } from './fs.js';

function requirePath(target) {
  if (!fs.existsSync(target)) {
    throw new Error(`Missing required source path: ${target}`);
  }
}

function copyRuntimeSubset(generatedRuntimeRoot, outputRoot) {
  ensureDirSync(outputRoot);
  for (const entry of ['SKILL.md', 'bin', 'review', 'qa', 'ETHOS.md']) {
    const source = path.join(generatedRuntimeRoot, entry);
    if (!fs.existsSync(source)) continue;
    const target = path.join(outputRoot, entry);
    copyPathSync(source, target);
  }
}

export function listFullPackSkills(generatedRoot) {
  return fs.readdirSync(generatedRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => name.startsWith('gstack-'))
    .sort((left, right) => left.localeCompare(right));
}

export function readUpstreamVersion(vendoredRoot) {
  const versionPath = path.join(vendoredRoot, 'VERSION');
  return fs.existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf8').trim() : 'unknown';
}

export function readUpstreamCommit(vendoredRoot) {
  const gitHeadPath = path.join(vendoredRoot, '.git', 'HEAD');
  if (!fs.existsSync(gitHeadPath)) return 'unknown';
  const head = fs.readFileSync(gitHeadPath, 'utf8').trim();
  if (!head.startsWith('ref: ')) return head;
  const refPath = path.join(vendoredRoot, '.git', head.slice(5));
  return fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8').trim() : 'unknown';
}

export function buildBundle({
  vendoredRoot,
  outputRoot,
  version,
  createdAt = new Date().toISOString(),
} = {}) {
  const generatedRoot = path.join(vendoredRoot, '.agents', 'skills');
  const generatedRuntimeRoot = path.join(generatedRoot, 'gstack');

  requirePath(generatedRoot);
  requirePath(generatedRuntimeRoot);

  removePathSync(outputRoot);

  const coreSkillRoot = path.join(outputRoot, 'packs', 'core', 'skills');
  const fullSkillRoot = path.join(outputRoot, 'packs', 'full', 'skills');
  const sharedRuntimeRoot = path.join(outputRoot, 'packs', 'runtime', 'gstack');

  ensureDirSync(coreSkillRoot);
  ensureDirSync(fullSkillRoot);

  for (const skillName of CORE_PACK_SKILLS) {
    copyPathSync(path.join(generatedRoot, skillName), path.join(coreSkillRoot, skillName));
  }

  const fullPackSkills = listFullPackSkills(generatedRoot);
  for (const skillName of fullPackSkills) {
    copyPathSync(path.join(generatedRoot, skillName), path.join(fullSkillRoot, skillName));
  }

  copyRuntimeSubset(generatedRuntimeRoot, sharedRuntimeRoot);
  const sharedRuntimeHash = hashDirectorySync(sharedRuntimeRoot);

  const manifest = {
    schema_version: BUNDLE_SCHEMA_VERSION,
    version,
    created_at: createdAt,
    upstream: {
      version: readUpstreamVersion(vendoredRoot),
      commit: readUpstreamCommit(vendoredRoot),
    },
    core_pack: {
      skills: CORE_PACK_SKILLS,
      skill_root: 'packs/core/skills',
      runtime_root: 'packs/runtime/gstack',
      skill_root_sha256: hashDirectorySync(coreSkillRoot),
      runtime_root_sha256: sharedRuntimeHash,
    },
    full_pack: {
      skills: fullPackSkills,
      skill_root: 'packs/full/skills',
      runtime_root: 'packs/runtime/gstack',
      skill_root_sha256: hashDirectorySync(fullSkillRoot),
      runtime_root_sha256: sharedRuntimeHash,
    },
  };

  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    outputRoot,
    manifest,
  };
}
