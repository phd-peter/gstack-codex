import fs from 'fs';
import path from 'path';
import { UPSTREAM_GSTACK_CONFIG_FILE } from './constants.js';
import { writeJsonSync } from './fs.js';
import { PACKAGE_ROOT } from './paths.js';

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`upstream gstack config is missing a valid \`${fieldName}\` string.`);
  }
  return value.trim();
}

export function resolveUpstreamConfigPath(packageRoot = PACKAGE_ROOT) {
  return path.join(packageRoot, UPSTREAM_GSTACK_CONFIG_FILE);
}

export function normalizeUpstreamConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('upstream gstack config must be a JSON object.');
  }

  return {
    repo_url: requireNonEmptyString(value.repo_url, 'repo_url'),
    branch: requireNonEmptyString(value.branch, 'branch'),
    generated_host: typeof value.generated_host === 'string' && value.generated_host.trim()
      ? value.generated_host.trim()
      : 'codex',
    pinned_version: requireNonEmptyString(value.pinned_version, 'pinned_version'),
    pinned_commit: requireNonEmptyString(value.pinned_commit, 'pinned_commit'),
  };
}

export function readUpstreamConfig(packageRoot = PACKAGE_ROOT) {
  const configPath = resolveUpstreamConfigPath(packageRoot);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing upstream gstack config at ${configPath}.`);
  }
  return normalizeUpstreamConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')));
}

export function writeUpstreamConfig(config, packageRoot = PACKAGE_ROOT) {
  const normalized = normalizeUpstreamConfig(config);
  writeJsonSync(resolveUpstreamConfigPath(packageRoot), normalized);
  return normalized;
}
