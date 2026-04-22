import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function ensureDirSync(target) {
  fs.mkdirSync(target, { recursive: true });
}

export function pathExistsSync(target) {
  return fs.existsSync(target);
}

export function readJsonIfExistsSync(target) {
  if (!pathExistsSync(target)) return null;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

export function atomicWriteFileSync(target, content) {
  ensureDirSync(path.dirname(target));
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, target);
}

export function writeJsonSync(target, value) {
  atomicWriteFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

export function removePathSync(target) {
  fs.rmSync(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

export function copyPathSync(source, target) {
  ensureDirSync(path.dirname(target));
  fs.cpSync(source, target, { recursive: true, force: true, dereference: true });
}

export function movePathSync(source, target) {
  ensureDirSync(path.dirname(target));
  try {
    fs.renameSync(source, target);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EXDEV') {
      copyPathSync(source, target);
      removePathSync(source);
      return;
    }
    throw error;
  }
}

export function listFilesRecursiveSync(root) {
  const files = [];
  if (!pathExistsSync(root)) return files;

  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  };

  walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

export function hashDirectorySync(root) {
  const hash = crypto.createHash('sha256');
  const files = listFilesRecursiveSync(root);
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    hash.update(relative);
    hash.update('\n');
    hash.update(fs.readFileSync(file));
    hash.update('\n');
  }
  return hash.digest('hex');
}

export function assertPathInside(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    return;
  }
  throw new Error(`${label} must stay within ${resolvedRoot}. Refusing to write ${resolvedTarget}.`);
}
