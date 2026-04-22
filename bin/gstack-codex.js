#!/usr/bin/env node

import { installGlobal } from '../src/install-global.js';
import { installProject } from '../src/install-project.js';
import { resolveBundleRoot } from '../src/paths.js';

function printHelp() {
  console.log(`gstack-codex

Usage:
  gstack-codex init --global
  gstack-codex init --project

Environment:
  GSTACK_CODEX_BUNDLE_ROOT   Override the release bundle root for local development/testing.
`);
}

function parseArgs(argv) {
  const [, , command, ...rest] = argv;
  const flags = new Set(rest);
  return {
    command,
    isGlobal: flags.has('--global'),
    isProject: flags.has('--project'),
    help: flags.has('--help') || flags.has('-h'),
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.command) {
    printHelp();
    process.exit(args.command ? 0 : 1);
  }

  if (args.command !== 'init') {
    console.error(`Unknown command: ${args.command}`);
    printHelp();
    process.exit(1);
  }

  if (Number(args.isGlobal) + Number(args.isProject) !== 1) {
    console.error('Specify exactly one of `--global` or `--project`.');
    process.exit(1);
  }

  const bundleRoot = resolveBundleRoot(process.env.GSTACK_CODEX_BUNDLE_ROOT);
  const result = args.isGlobal
    ? installGlobal({ bundleRoot })
    : installProject({ bundleRoot });

  for (const line of result.summaryLines) {
    console.log(line);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
