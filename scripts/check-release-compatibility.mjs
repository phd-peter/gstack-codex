import path from 'path';
import { PACKAGE_ROOT } from '../src/paths.js';
import { readPackageVersion } from '../src/package-metadata.js';
import { checkReleaseCompatibility } from '../src/release-compatibility.js';

function parseArgs(argv) {
  const version = readPackageVersion(PACKAGE_ROOT);
  const options = {
    releaseRoot: path.join(PACKAGE_ROOT, 'dist', 'releases', version),
    bundleRoot: path.join(PACKAGE_ROOT, 'bundle', 'current'),
    requireTarball: argv.includes('--require-tarball'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--release-root') {
      options.releaseRoot = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--bundle-root') {
      options.bundleRoot = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const result = checkReleaseCompatibility({
  packageRoot: PACKAGE_ROOT,
  releaseRoot: options.releaseRoot,
  bundleRoot: options.bundleRoot,
  requireTarball: options.requireTarball,
});

for (const warning of result.warnings ?? []) {
  console.warn(`warning: ${warning}`);
}

if (!result.ok) {
  for (const error of result.errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log('Release compatibility gate passed.');
console.log(`- upstream: ${result.summary.upstream.version} (${result.summary.upstream.commit})`);
console.log(`- core skills: ${result.summary.core_skill_count}`);
console.log(`- full skills: ${result.summary.full_skill_count}`);
