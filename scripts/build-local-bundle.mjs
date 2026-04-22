import path from 'path';
import { buildReleaseArtifacts } from '../src/release-artifacts.js';
import { PACKAGE_ROOT } from '../src/paths.js';
import { readPackageVersion } from '../src/package-metadata.js';

const result = buildReleaseArtifacts({
  packageRoot: PACKAGE_ROOT,
  releaseVersion: readPackageVersion(PACKAGE_ROOT),
  vendoredRoot: path.join(PACKAGE_ROOT, '.agents', 'skills', 'gstack'),
});

console.log(`Built release bundle at ${result.releaseRoot}`);
console.log(`Staged bundle at ${result.bundleCurrentRoot}`);
