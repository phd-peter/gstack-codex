import { buildReleaseArtifacts } from '../src/release-artifacts.js';
import { PACKAGE_ROOT } from '../src/paths.js';
import { readPackageVersion } from '../src/package-metadata.js';
import { assertPreparedVendoredRoot, resolveReleaseVendoredRoot } from '../src/upstream-source.js';

const result = buildReleaseArtifacts({
  packageRoot: PACKAGE_ROOT,
  releaseVersion: readPackageVersion(PACKAGE_ROOT),
  vendoredRoot: assertPreparedVendoredRoot(resolveReleaseVendoredRoot({ packageRoot: PACKAGE_ROOT })),
});

console.log(`Built release artifacts at ${result.releaseRoot}`);
console.log(`Staged bundle/current from ${result.releaseBundleRoot}`);
