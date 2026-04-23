import fs from 'fs';
import path from 'path';
import { PACKAGE_ROOT } from './paths.js';

export function resolveLocalVendoredGstackRoot(packageRoot = PACKAGE_ROOT) {
  return path.join(packageRoot, '.agents', 'skills', 'gstack');
}

export function resolveReleaseVendoredRoot({
  packageRoot = PACKAGE_ROOT,
  overrideRoot = process.env.GSTACK_CODEX_UPSTREAM_ROOT,
} = {}) {
  return overrideRoot
    ? path.resolve(overrideRoot)
    : resolveLocalVendoredGstackRoot(packageRoot);
}

export function assertPreparedVendoredRoot(vendoredRoot) {
  const generatedRoot = path.join(vendoredRoot, '.agents', 'skills');
  if (fs.existsSync(generatedRoot)) {
    return vendoredRoot;
  }

  throw new Error(
    `Missing prepared upstream gstack checkout at ${vendoredRoot}. `
    + 'Run `npm run bootstrap:upstream` first, or set `GSTACK_CODEX_UPSTREAM_ROOT` '
    + 'to a checkout where `bun run gen:skill-docs --host codex` has already been run.',
  );
}
