import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { PACKAGE_NAME } from './constants.js';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(SRC_DIR, '..');

export function resolveHomeDir(homeDir) {
  return homeDir ?? os.homedir();
}

export function resolveCodexHome(homeDir) {
  return path.join(resolveHomeDir(homeDir), '.codex');
}

export function resolveAgentsHome(homeDir) {
  return path.join(resolveHomeDir(homeDir), '.agents', 'skills');
}

export function resolveGlobalStateRoot(homeDir) {
  return path.join(resolveCodexHome(homeDir), PACKAGE_NAME);
}

export function resolveBundleRoot(override) {
  return override ? path.resolve(override) : path.join(PACKAGE_ROOT, 'bundle', 'current');
}

export function resolveProjectSkillsRoot(repoRoot) {
  return path.join(repoRoot, '.agents', 'skills');
}

export function resolveProjectStateFile(repoRoot) {
  return path.join(resolveProjectSkillsRoot(repoRoot), '.gstack-codex-manifest.json');
}
