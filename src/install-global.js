import fs from 'fs';
import path from 'path';
import { CORE_PACK_SKILLS, GLOBAL_MANAGED_STATE_FILE, PACKAGE_NAME, USER_FACING_CORE_COMMANDS } from './constants.js';
import { loadBundle, resolvePackRuntimeRoot, resolvePackSkillRoot, verifyPackIntegrity } from './bundle.js';
import { assertPathInside, ensureDirSync, movePathSync, readJsonIfExistsSync, writeJsonSync } from './fs.js';
import { ensureInstallRoots, ensureNoUnmanagedCollisions, migrateLegacyCodexInstall, pruneRemovedManagedPaths } from './install-common.js';
import { applyManagedBlock, renderManagedBlock } from './managed-block.js';
import { resolveAgentsHome, resolveCodexHome, resolveGlobalStateRoot, resolveHomeDir } from './paths.js';
import { runGlobalPreflight } from './preflight.js';
import { InstallTransaction } from './transaction.js';

export function installGlobal({
  bundleRoot,
  homeDir,
  codexBin,
  skipPreflight = false,
  failAfterStep = null,
} = {}) {
  const resolvedHome = resolveHomeDir(homeDir);
  const codexHome = resolveCodexHome(resolvedHome);
  const agentsHome = resolveAgentsHome(resolvedHome);
  const stateRoot = resolveGlobalStateRoot(resolvedHome);
  const stateFile = path.join(stateRoot, GLOBAL_MANAGED_STATE_FILE);

  ensureInstallRoots(codexHome, agentsHome, stateRoot);
  const preflight = skipPreflight ? { rawVersion: null, parsedVersion: null } : runGlobalPreflight({ homeDir: resolvedHome, codexBin });
  const bundle = loadBundle(bundleRoot);
  verifyPackIntegrity(bundle, 'core');

  const existingState = readJsonIfExistsSync(stateFile);
  const previousManaged = existingState?.managed_paths ?? [];
  const runtimeRoot = resolvePackRuntimeRoot(bundle, 'core');
  const skillRoot = resolvePackSkillRoot(bundle, 'core');
  const requestedManaged = ['gstack', ...CORE_PACK_SKILLS];

  ensureNoUnmanagedCollisions({
    root: agentsHome,
    requestedNames: requestedManaged,
    managedNames: previousManaged,
    label: '$HOME/.agents/skills',
  });

  const legacyMigration = migrateLegacyCodexInstall({ codexHome, stateRoot });
  if (legacyMigration) {
    movePathSync(legacyMigration.legacyPath, legacyMigration.backupPath);
  }

  const transaction = new InstallTransaction(path.join(stateRoot, 'transactions'));

  try {
    const agentsFile = path.join(codexHome, 'AGENTS.md');
    const currentAgents = fs.existsSync(agentsFile) ? fs.readFileSync(agentsFile, 'utf8') : '';
    const managedBlock = renderManagedBlock({
      scope: 'global',
      manifest: bundle.manifest,
      skillsPath: agentsHome,
    });
    const updatedAgents = applyManagedBlock(currentAgents, managedBlock);
    assertPathInside(codexHome, agentsFile, '~/.codex write');
    transaction.replaceFileFromString(updatedAgents.content, agentsFile);

    if (failAfterStep === 'global-agents') {
      throw new Error('Injected failure after AGENTS update.');
    }

    const runtimeTarget = path.join(agentsHome, 'gstack');
    assertPathInside(agentsHome, runtimeTarget, '$HOME/.agents/skills write');
    transaction.replacePathFromSource(runtimeRoot, runtimeTarget);

    for (const skillName of CORE_PACK_SKILLS) {
      const source = path.join(skillRoot, skillName);
      const target = path.join(agentsHome, skillName);
      assertPathInside(agentsHome, target, '$HOME/.agents/skills write');
      transaction.replacePathFromSource(source, target);
    }

    pruneRemovedManagedPaths({
      transaction,
      root: agentsHome,
      previousNames: previousManaged,
      nextNames: requestedManaged,
      allowedRoot: agentsHome,
      label: '$HOME/.agents/skills prune',
    });

    const nextState = {
      install_mode: 'global',
      version: bundle.manifest.version,
      upstream_commit: bundle.manifest.upstream.commit,
      upstream_version: bundle.manifest.upstream.version,
      installed_at: new Date().toISOString(),
      codex_version: preflight.parsedVersion ?? preflight.rawVersion ?? null,
      managed_paths: requestedManaged,
      legacy_backup_path: legacyMigration?.backupPath ?? null,
    };

    assertPathInside(stateRoot, stateFile, 'global state write');
    transaction.replaceFileFromString(`${JSON.stringify(nextState, null, 2)}\n`, stateFile);
    transaction.commit();

    return {
      summaryLines: [
        `Installed ${PACKAGE_NAME} core pack.`,
        `- Updated: ${agentsFile}`,
        `- Installed skills: ${agentsHome}`,
        `- Next: Open Codex and run ${USER_FACING_CORE_COMMANDS[0]}.`,
      ],
    };
  } catch (error) {
    transaction.rollback();
    if (legacyMigration && fs.existsSync(legacyMigration.backupPath) && !fs.existsSync(legacyMigration.legacyPath)) {
      movePathSync(legacyMigration.backupPath, legacyMigration.legacyPath);
    }
    throw error;
  }
}
