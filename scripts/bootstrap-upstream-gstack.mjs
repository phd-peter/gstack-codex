import path from 'path';
import { PACKAGE_ROOT } from '../src/paths.js';
import { prepareUpstreamCheckout } from '../src/upstream-bootstrap.js';

function parseArgs(argv) {
  const options = {
    refMode: 'pinned',
    clean: false,
    json: false,
    cacheDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--clean') {
      options.clean = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--latest') {
      options.refMode = 'latest';
      continue;
    }
    if (arg === '--pinned') {
      options.refMode = 'pinned';
      continue;
    }
    if (arg === '--cache-dir') {
      options.cacheDir = argv[index + 1] ? path.resolve(argv[index + 1]) : null;
      index += 1;
      continue;
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const prepared = prepareUpstreamCheckout({
  packageRoot: PACKAGE_ROOT,
  cacheDir: options.cacheDir ?? undefined,
  refMode: options.refMode,
  clean: options.clean,
});

if (options.json) {
  console.log(JSON.stringify(prepared, null, 2));
} else {
  console.log(`Prepared upstream gstack checkout at ${prepared.root}`);
  console.log(`- ref: ${prepared.ref_mode}`);
  console.log(`- version: ${prepared.version}`);
  console.log(`- commit: ${prepared.commit}`);
  console.log(`- generated host: ${prepared.generated_host}`);
}
