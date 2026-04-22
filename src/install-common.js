import fs from 'fs';
import path from 'path';
import { PACKAGE_NAME } from './constants.js';
import { assertPathInside, ensureDirSync, pathExistsSync, readJsonIfExistsSync } from './fs.js';

export function ensureNoUnmanagedCollisions({ root, requestedNames, managedNames, label }) {
  const managed = new Set(managedNames ?? []);
  for (const name of requestedNames) {
    const target = path.join(root, name);
    if (pathExistsSync(target) && !managed.has(name)) {
      throw new Error(`${label} already contains ${name}, but it is not managed by ${PACKAGE_NAME}. Refusing to overwrite it.`);
    }
  }
}

export function pruneRemovedManagedPaths({ transaction, root, previousNames, nextNames, allowedRoot, label }) {
  const next = new Set(nextNames);
  for (const name of previousNames ?? []) {
    if (next.has(name)) continue;
    const target = path.join(root, name);
    assertPathInside(allowedRoot, target, label);
    transaction.removeManagedPath(target);
  }
}

export function loadManagedNames(stateFile) {
  const state = readJsonIfExistsSync(stateFile);
  return state?.managed_paths ?? [];
}

export function ensureInstallRoots(...roots) {
  for (const root of roots) {
    ensureDirSync(root);
  }
}

export function migrateLegacyCodexInstall({ codexHome, stateRoot }) {
  const legacyPath = path.join(codexHome, 'skills', 'gstack');
  if (!fs.existsSync(legacyPath)) return null;

  const backupRoot = path.join(stateRoot, 'backups');
  ensureDirSync(backupRoot);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupRoot, `legacy-codex-skills-gstack-${timestamp}`);
  return { legacyPath, backupPath };
}
