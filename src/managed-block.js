import { MANAGED_BLOCK_END, MANAGED_BLOCK_START, USER_FACING_CORE_COMMANDS } from './constants.js';

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

export function renderManagedBlock({ scope, manifest, skillsPath }) {
  const headline = scope === 'global'
    ? '## gstack-codex Global Install'
    : '## gstack-codex Project Install';
  const summary = scope === 'global'
    ? 'This block is managed by gstack-codex. Global user skills live in `$HOME/.agents/skills`.'
    : 'This block is managed by gstack-codex. Repo-local skills live in `.agents/skills`.';
  const extra = scope === 'global'
    ? 'Open Codex and run `/office-hours`.'
    : 'Heavy browser/runtime binaries stay machine-local. Repo installs commit generated skills plus lightweight runtime assets.';

  const lines = [
    MANAGED_BLOCK_START,
    headline,
    '',
    summary,
    `Installed release: \`${manifest.version}\``,
    `Upstream gstack: \`${manifest.upstream.version}\` @ \`${manifest.upstream.commit}\``,
    `Managed skills root: \`${skillsPath}\``,
    `Core commands: ${USER_FACING_CORE_COMMANDS.join(', ')}`,
    extra,
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
