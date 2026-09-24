import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { matchesAny } from '../glob.js';

/**
 * Baseline comparison (architecture §3.5/§3.9/§4.3): every working-tree
 * change versus the task pack's pinned `baseTree` — committed, renamed,
 * and untracked — filtered through the ignore manifest, classified against
 * the handoff's in-scope set. Host-mediated out-of-scope changes are
 * DETECTED here even when they were made outside the kit wrapper.
 */

export type ChangeClass = 'committed' | 'renamed' | 'untracked' | 'deleted';

export interface BaselineChange {
  readonly path: string;
  readonly changeClass: ChangeClass;
  readonly inScope: boolean;
  readonly ignored: boolean;
}

export interface BaselineComparison {
  readonly baseTree: string;
  readonly changes: readonly BaselineChange[];
  readonly escapes: readonly BaselineChange[];
}

interface NameStatusEntry {
  readonly status: string;
  readonly paths: readonly string[];
}

function runGit(repoRoot: string, args: readonly string[]): string | null {
  const result = spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  if (result.status !== 0 || result.stdout === undefined) return null;
  return result.stdout;
}

function parseNameStatus(output: string): readonly NameStatusEntry[] {
  const parts = output.split('\0').filter((part) => part.length > 0);
  const entries: NameStatusEntry[] = [];
  let index = 0;
  while (index < parts.length) {
    const code = parts[index];
    if (code === undefined) break;
    index += 1;
    if (code.startsWith('R') || code.startsWith('C')) {
      const from = parts[index];
      const to = parts[index + 1];
      index += 2;
      if (from === undefined || to === undefined) break;
      entries.push({ status: code, paths: [from.replace(/\\/g, '/'), to.replace(/\\/g, '/')] });
    } else {
      const path = parts[index];
      index += 1;
      if (path === undefined) break;
      entries.push({ status: code, paths: [path.replace(/\\/g, '/')] });
    }
  }
  return entries;
}

function changeClassOf(status: string): ChangeClass {
  if (status.startsWith('R') || status.startsWith('C')) return 'renamed';
  if (status.startsWith('D')) return 'deleted';
  if (status === '?') return 'untracked';
  return 'committed';
}

/** Compare the working tree against the pinned baseline through the ignore manifest. */
export function compareBaseline(
  repoRoot: string,
  baseTree: string,
  inScopePaths: readonly string[],
  ignoreManifest: readonly string[],
): BaselineComparison | null {
  const tracked = runGit(repoRoot, ['diff', '--name-status', '-z', baseTree, '--']);
  if (tracked === null) return null;
  const untracked = runGit(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (untracked === null) return null;

  // The task packs themselves are never in scope for comparison.
  const alwaysIgnored = [...ignoreManifest, '.builder-kit/**', '.git/**'];
  const changes: BaselineChange[] = [];
  for (const entry of parseNameStatus(tracked)) {
    for (const path of entry.paths) {
      const ignored = matchesAny(path, alwaysIgnored);
      const inScope = matchesAny(path, inScopePaths);
      changes.push({ path, changeClass: changeClassOf(entry.status), inScope, ignored });
    }
  }
  for (const part of untracked.split('\0')) {
    if (part.length === 0) continue;
    const path = part.replace(/\\/g, '/');
    const ignored = matchesAny(path, alwaysIgnored);
    const inScope = matchesAny(path, inScopePaths);
    changes.push({ path, changeClass: 'untracked', inScope, ignored });
  }
  const escapes = changes.filter((change) => !change.ignored && !change.inScope);
  return { baseTree, changes, escapes };
}

/** Load a task pack document (used by the gate's baseline comparison). */
export function loadTaskPack(path: string): {
  readonly baseTree: string;
  readonly inScopePaths: readonly string[];
  readonly ignoreManifest: readonly string[];
  readonly bytes: Buffer;
} | null {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    return null;
  }
  const parsed = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
  const baseTree = parsed['baseTree'];
  const inScopePaths = parsed['inScopePaths'];
  const ignoreManifest = parsed['ignoreManifest'];
  if (
    typeof baseTree !== 'string' ||
    !Array.isArray(inScopePaths) ||
    !Array.isArray(ignoreManifest)
  ) {
    return null;
  }
  return {
    baseTree,
    inScopePaths: inScopePaths.filter((p): p is string => typeof p === 'string'),
    ignoreManifest: ignoreManifest.filter((p): p is string => typeof p === 'string'),
    bytes,
  };
}

export function taskPackRoot(repoRoot: string): string {
  return join(repoRoot, '.builder-kit', 'packs');
}
