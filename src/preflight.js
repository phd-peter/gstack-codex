import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { MIN_CODEX_VERSION } from './constants.js';
import { resolveCodexHome } from './paths.js';

function parseSemver(raw) {
  const match = raw.match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match[0] : null;
}

function isVersionLessThan(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) return true;
    if (leftPart > rightPart) return false;
  }
  return false;
}

function hasCodexAuth(homeDir) {
  const key1 = (process.env.CODEX_API_KEY ?? '').trim();
  const key2 = (process.env.OPENAI_API_KEY ?? '').trim();
  if (key1 || key2) return true;

  const authPath = path.join(resolveCodexHome(homeDir), 'auth.json');
  return fs.existsSync(authPath);
}

function runCodexVersionProbe(codexBin) {
  let candidates;
  if (process.platform === 'win32') {
    const directCandidates = !path.extname(codexBin)
      ? [codexBin, `${codexBin}.cmd`, `${codexBin}.bat`, `${codexBin}.exe`]
      : [codexBin];

    const usesPathLookup = !path.isAbsolute(codexBin) && !codexBin.includes(path.sep);
    if (usesPathLookup) {
      const whereResult = spawnSync('where.exe', [codexBin], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const resolved = whereResult.status === 0
        ? whereResult.stdout
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean)
        : [];
      candidates = [...resolved, ...directCandidates];
    } else {
      candidates = directCandidates;
    }
  } else {
    candidates = [codexBin];
  }

  for (const candidate of candidates) {
    const extension = path.extname(candidate).toLowerCase();
    const result = process.platform === 'win32' && (extension === '.cmd' || extension === '.bat')
      ? spawnSync(candidate, ['--version'], {
        shell: true,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      : spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    if (!result.error && result.status === 0) {
      return result;
    }
  }

  return spawnSync(codexBin, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function runGlobalPreflight({ homeDir, codexBin = 'codex' }) {
  const versionResult = runCodexVersionProbe(codexBin);

  if (versionResult.error || versionResult.status !== 0) {
    throw new Error('Codex CLI not found. Install it first, then rerun `npx gstack-codex init --global`.');
  }

  const rawVersion = `${versionResult.stdout ?? ''}${versionResult.stderr ?? ''}`.trim().split(/\r?\n/, 1)[0] ?? '';
  const parsedVersion = parseSemver(rawVersion);
  if (parsedVersion && isVersionLessThan(parsedVersion, MIN_CODEX_VERSION)) {
    throw new Error(`Codex CLI ${rawVersion} is too old. gstack-codex requires codex-cli ${MIN_CODEX_VERSION}+.`);
  }

  if (!hasCodexAuth(homeDir)) {
    throw new Error('No Codex authentication found. Run `codex login` or set `$CODEX_API_KEY` / `$OPENAI_API_KEY`, then rerun.');
  }

  return { rawVersion, parsedVersion };
}
