import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ensureDirSync, removePathSync } from './fs.js';
import { PACKAGE_ROOT } from './paths.js';
import { readUpstreamConfig } from './upstream-config.js';

function runCommand(command, args, { cwd = PACKAGE_ROOT, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    if (allowFailure) {
      return {
        ok: false,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      };
    }
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `${command} failed`).trim();
    if (allowFailure) {
      return {
        ok: false,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      };
    }
    throw new Error(detail);
  }

  return {
    ok: true,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function ensureClone({ repoUrl, branch, root, packageRoot }) {
  const gitDir = path.join(root, '.git');
  if (fs.existsSync(gitDir)) {
    runCommand('git', ['-C', root, 'fetch', '--force', 'origin', branch], { cwd: packageRoot });
    return;
  }

  ensureDirSync(path.dirname(root));
  runCommand(
    'git',
    ['clone', '--filter=blob:none', '--single-branch', '--branch', branch, repoUrl, root],
    { cwd: packageRoot },
  );
}

function runBun(cwd, args, { fallbackArgs = null } = {}) {
  const frozen = runCommand('bun', args, { cwd, allowFailure: Boolean(fallbackArgs) });
  if (frozen.ok || !fallbackArgs) {
    if (!frozen.ok) {
      throw new Error((frozen.stderr || frozen.stdout || 'bun command failed').trim());
    }
    return frozen;
  }

  return runCommand('bun', fallbackArgs, { cwd });
}

export function readLatestUpstreamCommit({ packageRoot = PACKAGE_ROOT } = {}) {
  const config = readUpstreamConfig(packageRoot);
  const result = runCommand('git', ['ls-remote', config.repo_url, config.branch], { cwd: packageRoot });
  const firstLine = result.stdout.split(/\r?\n/).find(Boolean);
  if (!firstLine) {
    throw new Error(`Could not resolve latest upstream commit for ${config.repo_url} ${config.branch}.`);
  }

  return {
    repo_url: config.repo_url,
    branch: config.branch,
    commit: firstLine.split(/\s+/)[0],
  };
}

export function prepareUpstreamCheckout({
  packageRoot = PACKAGE_ROOT,
  cacheDir = process.env.GSTACK_CODEX_UPSTREAM_CACHE_DIR || path.join(packageRoot, 'dist', '.upstream', 'gstack'),
  refMode = 'pinned',
  clean = false,
  installDependencies = true,
  generateHost = null,
} = {}) {
  const config = readUpstreamConfig(packageRoot);
  const root = path.resolve(cacheDir);

  if (clean) {
    removePathSync(root);
  }

  ensureClone({
    repoUrl: config.repo_url,
    branch: config.branch,
    root,
    packageRoot,
  });

  const targetRef = refMode === 'latest' ? `origin/${config.branch}` : config.pinned_commit;
  runCommand('git', ['-C', root, 'checkout', '--force', targetRef], { cwd: packageRoot });
  runCommand('git', ['-C', root, 'reset', '--hard', 'HEAD'], { cwd: packageRoot });

  removePathSync(path.join(root, '.agents'));

  if (installDependencies) {
    runBun(root, ['install', '--frozen-lockfile'], { fallbackArgs: ['install'] });
  }

  const resolvedHost = generateHost ?? config.generated_host;
  runCommand('bun', ['run', 'gen:skill-docs', '--host', resolvedHost], { cwd: root });

  const commit = runCommand('git', ['-C', root, 'rev-parse', 'HEAD'], { cwd: packageRoot }).stdout;
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();

  return {
    root,
    repo_url: config.repo_url,
    branch: config.branch,
    generated_host: resolvedHost,
    commit,
    version,
    ref_mode: refMode,
  };
}
