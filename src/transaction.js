import fs from 'fs';
import path from 'path';
import { copyPathSync, ensureDirSync, movePathSync, removePathSync } from './fs.js';

export class InstallTransaction {
  constructor(workRoot) {
    ensureDirSync(workRoot);
    this.root = fs.mkdtempSync(path.join(workRoot, 'txn-'));
    this.stageRoot = path.join(this.root, 'stage');
    this.backupRoot = path.join(this.root, 'backup');
    this.installLog = [];
    this.backupLog = [];
    this.sequence = 0;
  }

  nextStagePath(name) {
    this.sequence += 1;
    const folder = path.join(this.stageRoot, `${String(this.sequence).padStart(4, '0')}-${name}`);
    ensureDirSync(path.dirname(folder));
    return folder;
  }

  backupExisting(targetPath) {
    if (!fs.existsSync(targetPath)) return null;
    const backupPath = path.join(this.backupRoot, `${String(this.backupLog.length).padStart(4, '0')}-${path.basename(targetPath)}`);
    ensureDirSync(path.dirname(backupPath));
    movePathSync(targetPath, backupPath);
    const entry = { backupPath, targetPath };
    this.backupLog.push(entry);
    return entry;
  }

  replacePathFromSource(sourcePath, targetPath) {
    const stagedPath = this.nextStagePath(path.basename(targetPath));
    copyPathSync(sourcePath, stagedPath);
    this.backupExisting(targetPath);
    movePathSync(stagedPath, targetPath);
    this.installLog.push(targetPath);
  }

  replaceFileFromString(content, targetPath) {
    const stagedPath = this.nextStagePath(path.basename(targetPath));
    fs.writeFileSync(stagedPath, content, 'utf8');
    this.backupExisting(targetPath);
    movePathSync(stagedPath, targetPath);
    this.installLog.push(targetPath);
  }

  removeManagedPath(targetPath) {
    this.backupExisting(targetPath);
    removePathSync(targetPath);
  }

  rollback() {
    for (let index = this.installLog.length - 1; index >= 0; index -= 1) {
      removePathSync(this.installLog[index]);
    }

    for (let index = this.backupLog.length - 1; index >= 0; index -= 1) {
      const { backupPath, targetPath } = this.backupLog[index];
      if (fs.existsSync(backupPath)) {
        movePathSync(backupPath, targetPath);
      }
    }

    removePathSync(this.root);
  }

  commit() {
    removePathSync(this.root);
  }
}
