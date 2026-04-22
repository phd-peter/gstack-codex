import fs from 'fs';
import path from 'path';
import { PACKAGE_ROOT } from './paths.js';

export function readPackageManifest(packageRoot = PACKAGE_ROOT) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

export function readPackageVersion(packageRoot = PACKAGE_ROOT) {
  return readPackageManifest(packageRoot).version;
}
