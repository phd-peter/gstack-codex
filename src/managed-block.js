import { MANAGED_BLOCK_END, MANAGED_BLOCK_START, USER_FACING_CORE_COMMANDS } from './constants.js';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

export function renderManagedBlock({ scope, manifest, skillsPath, skillEntries }) {
  const refreshCommand = scope === 'global'
    ? 'npx gstack-codex init --global'
    : 'npx gstack-codex init --project';
  const installNote = scope === 'global'
    ? 'This machine currently has the `core` pack installed.'
    : 'This repo currently has the `full` pack installed.';
  const footerNote = scope === 'global'
    ? 'Open Codex and run `/office-hours`.'
    : 'Repo installs include the full generated skill pack. Heavy browser/runtime binaries stay machine-local in v1.';

  const lines = [
    MANAGED_BLOCK_START,
    '## gstack — AI Engineering Workflow',
    '',
    'This block is managed by `gstack-codex`. Do not edit inside this block.',
    '',
    `Skills live in \`${skillsPath}\`. Invoke them by name, e.g. \`${USER_FACING_CORE_COMMANDS[0]}\`.`,
    `Refresh with \`${refreshCommand}\`.`,
    installNote,
    '',
    '## Available skills',
    '',
    '| Skill | What it does |',
    '|-------|-------------|',
    ...(skillEntries ?? []).map(entry => `| \`${entry.command}\` | ${entry.summary} |`),
    '',
    footerNote,
    `Installed release: \`${manifest.version}\``,
    MANAGED_BLOCK_END,
  ];

  return `${lines.join('\n')}\n`;
}

export function applyManagedBlock(existingContent, managedBlock) {
  const current = existingContent ?? '';
  const startCount = countOccurrences(current, MANAGED_BLOCK_START);
  const endCount = countOccurrences(current, MANAGED_BLOCK_END);

  if (startCount !== endCount) {
    throw new Error('Existing AGENTS.md has a broken gstack-codex managed block. Refusing to rewrite it.');
  }
  if (startCount > 1 || endCount > 1) {
    throw new Error('Existing AGENTS.md has multiple gstack-codex managed blocks. Refusing to rewrite it.');
  }

  if (startCount === 1) {
    const startIndex = current.indexOf(MANAGED_BLOCK_START);
    const endIndex = current.indexOf(MANAGED_BLOCK_END);
    const afterEndIndex = endIndex + MANAGED_BLOCK_END.length;
    const suffix = current.slice(afterEndIndex).replace(/^\r?\n/, '');
    const prefix = current.slice(0, startIndex).replace(/\s*$/, '');
    const next = [prefix, managedBlock.trimEnd(), suffix].filter(Boolean).join('\n\n');
    return { content: `${next}\n`, mode: 'replaced' };
  }

  if (!current.trim()) {
    return { content: managedBlock, mode: 'created' };
  }

  const separator = current.endsWith('\n') ? '\n' : '\n\n';
  return { content: `${current}${separator}${managedBlock}`, mode: 'appended' };
}
