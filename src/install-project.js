import fs from 'fs';
import path from 'path';
import { PROJECT_MANAGED_STATE_FILE } from './constants.js';
import { listPackSkillMetadata, loadBundle, resolvePackRuntimeRoot, resolvePackSkillRoot, verifyPackIntegrity } from './bundle.js';
import { assertPathInside, readJsonIfExistsSync } from './fs.js';
import { ensureInstallRoots, ensureNoUnmanagedCollisions, pruneRemovedManagedPaths } from './install-common.js';
import { applyManagedBlock, renderManagedBlock } from './managed-block.js';
import { resolveProjectSkillsRoot } from './paths.js';
import { InstallTransaction } from './transaction.js';

function resolveProjectRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return { root: current, detectedGitRepo: true };
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return { root: path.resolve(startDir), detectedGitRepo: false };
}

export function installProject({
  bundleRoot,
  cwd = process.cwd(),
  repoRoot,
  failAfterStep = null,
} = {}) {
  const projectRoot = repoRoot
    ? { root: path.resolve(repoRoot), detectedGitRepo: fs.existsSync(path.join(path.resolve(repoRoot), '.git')) }
    : resolveProjectRoot(cwd);
  const resolvedRepo = projectRoot.root;
  const skillsRoot = resolveProjectSkillsRoot(resolvedRepo);
  const stateFile = path.join(skillsRoot, PROJECT_MANAGED_STATE_FILE);

  ensureInstallRoots(resolvedRepo, skillsRoot);
  const bundle = loadBundle(bundleRoot);
  verifyPackIntegrity(bundle, 'full');

  const existingState = readJsonIfExistsSync(stateFile);
  const previousManaged = existingState?.managed_paths ?? [];
  const runtimeRoot = resolvePackRuntimeRoot(bundle, 'full');
  const skillRoot = resolvePackSkillRoot(bundle, 'full');
  const skillEntries = listPackSkillMetadata(bundle, 'full');
  const nextManaged = ['gstack', ...bundle.manifest.full_pack.skills];

  ensureNoUnmanagedCollisions({
    root: skillsRoot,
    requestedNames: nextManaged,
    managedNames: previousManaged,
    label: `${resolvedRepo} .agents/skills`,
  });

  const transaction = new InstallTransaction(path.join(resolvedRepo, '.gstack-codex-txn'));

  try {
    const agentsFile = path.join(resolvedRepo, 'AGENTS.md');
    const currentAgents = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf8') : '';
    const managedBlock = renderManagedBlock({
      scope: 'project',
      manifest: bundle.manifest,
      skillsPath: '.agents/skills',
      skillEntries,
    });
    const updatedAgents = applyManagedBlock(currentAgents, managedBlock);
    assertPathInside(resolvedRepo, agentsFile, 'repo AGENTS write');
    transaction.replaceFileFromString(updatedAgents.content, agentsFile);

    if (failAfterStep === 'project-agents') {
      throw new Error('Injected failure after project AGENTS update.');
    }

    const runtimeTarget = path.join(skillsRoot, 'gstack');
    assertPathInside(resolvedRepo, runtimeTarget, 'repo skills write');
    transaction.replacePathFromSource(runtimeRoot, runtimeTarget);

    for (const skillName of bundle.manifest.full_pack.skills) {
      const source = path.join(skillRoot, skillName);
      const target = path.join(skillsRoot, skillName);
      assertPathInside(resolvedRepo, target, 'repo skills write');
      transaction.replacePathFromSource(source, target);
    }

    pruneRemovedManagedPaths({
      transaction,
      root: skillsRoot,
      previousNames: previousManaged,
      nextNames: nextManaged,
      allowedRoot: resolvedRepo,
      label: 'repo skills prune',
    });

    const nextState = {
      install_mode: 'project',
      version: bundle.manifest.version,
      upstream_commit: bundle.manifest.upstream.commit,
      upstream_version: bundle.manifest.upstream.version,
      installed_at: new Date().toISOString(),
      managed_paths: nextManaged,
    };

    assertPathInside(resolvedRepo, stateFile, 'repo manifest write');
    transaction.replaceFileFromString(`${JSON.stringify(nextState, null, 2)}\n`, stateFile);
    transaction.commit();

    return {
      summaryLines: [
        `Installed gstack-codex full project pack into ${resolvedRepo}.`,
        ...(projectRoot.detectedGitRepo ? [] : ['- No git repo found: used the current directory as the project root']),
        '- Updated: AGENTS.md managed block',
        '- Updated: .agents/skills generated pack',
        '- Heavy browser/runtime binaries remain machine-local.',
      ],
    };
  } catch (error) {
    transaction.rollback();
    throw error;
  }
}
