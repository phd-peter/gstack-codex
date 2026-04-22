export const PACKAGE_NAME = 'gstack-codex';
export const MIN_CODEX_VERSION = '0.122.0';
export const BUNDLE_SCHEMA_VERSION = 1;

export const CORE_PACK_SKILLS = [
  'gstack-upgrade',
  'gstack-office-hours',
  'gstack-plan-ceo-review',
  'gstack-plan-eng-review',
  'gstack-review',
  'gstack-ship',
];

export const USER_FACING_CORE_COMMANDS = [
  '/office-hours',
  '/plan-ceo-review',
  '/plan-eng-review',
  '/review',
  '/ship',
];

export const MANAGED_BLOCK_START = '<!-- BEGIN GSTACK-CODEX MANAGED BLOCK -->';
export const MANAGED_BLOCK_END = '<!-- END GSTACK-CODEX MANAGED BLOCK -->';

export const GLOBAL_MANAGED_STATE_FILE = 'install-state.json';
export const PROJECT_MANAGED_STATE_FILE = '.gstack-codex-manifest.json';
