import fs from 'fs';
import path from 'path';
import { BUNDLE_SCHEMA_VERSION } from './constants.js';
import { hashDirectorySync, pathExistsSync } from './fs.js';

const PREFERRED_SKILL_ORDER = [
  'office-hours',
  'plan-ceo-review',
  'plan-eng-review',
  'plan-design-review',
  'design-consultation',
  'review',
  'investigate',
  'design-review',
  'qa',
  'qa-only',
  'ship',
  'document-release',
  'retro',
  'browse',
  'setup-browser-cookies',
  'careful',
  'freeze',
  'guard',
  'unfreeze',
  'gstack-upgrade',
];

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

function parseFrontmatter(content) {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return null;
  }

  const normalized = content.replace(/\r\n/g, '\n');
  const closingIndex = normalized.indexOf('\n---\n', 4);
  if (closingIndex === -1) return null;

  return normalized.slice(4, closingIndex);
}

function extractField(frontmatter, fieldName) {
  const match = frontmatter.match(new RegExp(`^${fieldName}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function extractDescription(frontmatter) {
  const lines = frontmatter.split('\n');
  const startIndex = lines.findIndex(line => line.trim() === 'description: |');
  if (startIndex === -1) return null;

  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('  ')) break;
    collected.push(line.slice(2));
  }

  if (collected.length === 0) return null;
  return collected.join(' ').replace(/\s+/g, ' ').trim();
}

function summarizeDescription(description, fallbackName) {
  if (!description) return `Invoke \`/${fallbackName}\` when it matches the task.`;

  const compact = description.replace(/\s+/g, ' ').trim().replace(/\s*\(gstack\)\.?$/, '');
  const sentences = compact.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) {
    return compact;
  }

  const first = sentences[0].trim();
  if (first.length >= 60 || sentences.length === 1) {
    return first;
  }

  return `${first} ${sentences[1].trim()}`;
}

function commandNameFromSkillDir(skillDirName) {
  return skillDirName === 'gstack-upgrade'
    ? 'gstack-upgrade'
    : skillDirName.replace(/^gstack-/, '');
}

function skillSortIndex(commandName) {
  const index = PREFERRED_SKILL_ORDER.indexOf(commandName);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function listPackSkillMetadata(bundle, packName) {
  const pack = getPack(bundle, packName);
  const skillRoot = resolvePackSkillRoot(bundle, packName);

  return pack.skills.map(skillDirName => {
    const skillFile = path.join(skillRoot, skillDirName, 'SKILL.md');
    const content = pathExistsSync(skillFile) ? fs.readFileSync(skillFile, 'utf8') : '';
    const frontmatter = parseFrontmatter(content);
    const fallbackCommand = commandNameFromSkillDir(skillDirName);
    const commandName = frontmatter ? (extractField(frontmatter, 'name') ?? fallbackCommand) : fallbackCommand;
    const description = frontmatter ? extractDescription(frontmatter) : null;

    return {
      commandName,
      command: `/${commandName}`,
      summary: summarizeDescription(description, commandName),
    };
  }).sort((left, right) => {
    const orderDelta = skillSortIndex(left.commandName) - skillSortIndex(right.commandName);
    if (orderDelta !== 0) return orderDelta;
    return left.commandName.localeCompare(right.commandName);
  });
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
