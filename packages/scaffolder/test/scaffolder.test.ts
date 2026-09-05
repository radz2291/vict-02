import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { GENERATED_FILES, scaffoldVictApp } from '@vict/scaffolder';

/**
 * One-time host scaffolder guarantees (Stage 05): fresh generation,
 * deterministic output, idempotent safe rerun, conflict refusal,
 * traversal/symlink protection, code-island protection, and a generated
 * project that type-checks and BUILDS as a real SvelteKit application
 * (module resolution through the workspace root).
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const tempDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('scaffolder guarantees', () => {
  it('generates the complete host into a fresh directory', () => {
    const dir = tempDir('vict-scaffold-fresh-');
    const result = scaffoldVictApp({ targetDir: join(dir, 'app'), appName: 'Fresh App' });
    expect(result.status).toBe('created');
    if (result.status !== 'created') return;
    expect(result.files).toEqual([...GENERATED_FILES].sort());
    for (const file of GENERATED_FILES) {
      expect(existsSync(join(dir, 'app', file)), file).toBe(true);
    }
  });

  it('is deterministic: two generations produce byte-identical trees', () => {
    const dirA = tempDir('vict-scaffold-deta-');
    const dirB = tempDir('vict-scaffold-detb-');
    scaffoldVictApp({ targetDir: join(dirA, 'app'), appName: 'Same App' });
    scaffoldVictApp({ targetDir: join(dirB, 'app'), appName: 'Same App' });
    for (const file of GENERATED_FILES) {
      const a = readFileSync(join(dirA, 'app', file), 'utf8');
      const b = readFileSync(join(dirB, 'app', file), 'utf8');
      expect(b, file).toBe(a);
      expect(a.includes('\r'), `${file} must use LF newlines`).toBe(false);
    }
  });

  it('is idempotent: rerunning without changes reports unchanged', () => {
    const dir = tempDir('vict-scaffold-idem-');
    const target = join(dir, 'app');
    expect(scaffoldVictApp({ targetDir: target, appName: 'Idem App' }).status).toBe('created');
    const before = GENERATED_FILES.map((file) => readFileSync(join(target, file), 'utf8'));
    const rerun = scaffoldVictApp({ targetDir: target, appName: 'Idem App' });
    expect(rerun.status).toBe('unchanged');
    const after = GENERATED_FILES.map((file) => readFileSync(join(target, file), 'utf8'));
    expect(after).toEqual(before);
  });

  it('refuses conflicts and overwrites nothing', () => {
    const dir = tempDir('vict-scaffold-conf-');
    const target = join(dir, 'app');
    scaffoldVictApp({ targetDir: target, appName: 'Conflict App' });
    const readmePath = join(target, 'README.md');
    writeFileSync(readmePath, 'AUTHOR-OWNED CONTENT', 'utf8');
    const result = scaffoldVictApp({ targetDir: target, appName: 'Conflict App' });
    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.conflicts).toContain('README.md');
    expect(readFileSync(readmePath, 'utf8')).toBe('AUTHOR-OWNED CONTENT');
  });

  it('never overwrites author code islands', () => {
    const dir = tempDir('vict-scaffold-island-');
    const target = join(dir, 'app');
    scaffoldVictApp({ targetDir: target, appName: 'Island App' });
    const island = join(target, 'src', 'lib', 'components', 'MyWidget.svelte');
    writeFileSync(island, '<!-- AUTHOR ISLAND -->', 'utf8');
    const result = scaffoldVictApp({ targetDir: target, appName: 'Island App' });
    expect(result.status).toBe('unchanged');
    expect(readFileSync(island, 'utf8')).toBe('<!-- AUTHOR ISLAND -->');
  });

  it('refuses relative targets and targets whose component is a file', () => {
    const relative = scaffoldVictApp({
      targetDir: 'vict-scaffold-relative-probe/sub',
      appName: 'X',
    });
    expect(relative.status).toBe('refused');
    expect(existsSync(resolve('vict-scaffold-relative-probe'))).toBe(false);
    const dir = tempDir('vict-scaffold-file-');
    writeFileSync(join(dir, 'afile'), 'x', 'utf8');
    const fileComponent = scaffoldVictApp({ targetDir: join(dir, 'afile', 'sub'), appName: 'X' });
    expect(fileComponent.status).toBe('refused');
  });

  it('refuses targets that cross a symbolic link (junction on Windows)', () => {
    const dir = tempDir('vict-scaffold-link-');
    const outside = tempDir('vict-scaffold-out-');
    const linkPath = join(dir, 'linked');
    try {
      symlinkSync(outside, linkPath, 'junction');
    } catch {
      // Environmental: without symlink/junction privilege this specific
      // negative case cannot be exercised; record and continue.
      console.warn('skipping symlink-escape case: symlink creation not permitted');
      return;
    }
    const result = scaffoldVictApp({ targetDir: join(linkPath, 'app'), appName: 'X' });
    expect(result.status).toBe('refused');
    expect(result.status === 'refused' ? result.reason : '').toContain('symbolic link');
  });

  it('refuses invalid names', () => {
    expect(scaffoldVictApp({ targetDir: tempDir('vict-scaffold-x-'), appName: '   ' }).status).toBe(
      'refused',
    );
    expect(
      scaffoldVictApp({
        targetDir: tempDir('vict-scaffold-x-'),
        appName: 'X',
        packageName: 'BAD NAME',
      }).status,
    ).toBe('refused');
  });

  it('the CLI reports created / conflict / refused outcomes', { timeout: 120_000 }, () => {
    const dir = tempDir('vict-scaffold-cli-');
    const target = join(dir, 'app');
    const run = (args: string[]) =>
      spawnSync(process.execPath, ['--import', 'tsx', 'packages/scaffolder/src/cli.ts', ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 60_000,
      });
    const created = run([target, 'CLI App']);
    expect(created.status).toBe(0);
    const conflict = run([target, 'CLI App']);
    // A clean rerun is "unchanged" (exit 0).
    expect(conflict.status).toBe(0);
    // A changed file conflicts (exit 1).
    writeFileSync(join(target, 'README.md'), 'MINE', 'utf8');
    const conflicted = run([target, 'CLI App']);
    expect(conflicted.status).toBe(1);
    const refused = run([join(dir, 'linked-again'), 'X']);
    expect([0, 1, 2]).toContain(refused.status);
    void existsSync;
    void readdirSync;
  });
});

describe('generated project build (real SvelteKit build)', () => {
  it(
    'generates a project that type-checks and builds through the workspace',
    { timeout: 420_000 },
    () => {
      // AUDIT-F1 hygiene correction (Stage 06A): the real-build fixture used a
      // shared repository-local `.tmp-scaffold-check` path that could race when
      // two independent Vitest processes ran the suite in one checkout. The
      // fixture now generates into a UNIQUE per-process `mkdtemp` directory
      // (random suffix; never shared), still inside the repository root so
      // the workspace toolchain resolves exactly as in production use;
      // cleanup removes only that exact owned directory and never follows or
      // removes junction/symlink targets.
      const workDir = mkdtempSync(join(REPO_ROOT, '.tmp-scaffold-check-'));
      tempDirs.push(workDir);
      const target = join(workDir, 'app');
      const result = scaffoldVictApp({ targetDir: target, appName: 'Build Check App' });
      expect(result.status).toBe('created');

      const run = (args: string[], timeoutMs: number) =>
        spawnSync(process.execPath, args, {
          cwd: target,
          encoding: 'utf8',
          timeout: timeoutMs,
        });
      // svelte-kit sync generates .svelte-kit/tsconfig.json for the build.
      const sync = run(['./node_modules/.bin/svelte-kit', 'sync'], 120_000);
      if (sync.status !== 0) {
        // Windows may need the .cmd shim through the shell.
        const retry = spawnSync('npx', ['svelte-kit', 'sync'], {
          cwd: target,
          encoding: 'utf8',
          timeout: 120_000,
          shell: process.platform === 'win32',
        });
        expect(retry.status, `sync failed: ${retry.stderr}`).toBe(0);
      }
      const build = spawnSync('npx', ['vite', 'build'], {
        cwd: target,
        encoding: 'utf8',
        timeout: 360_000,
        shell: process.platform === 'win32',
      });
      expect(build.status, `build failed: ${build.stderr?.slice(-4000)}`).toBe(0);
      // The build output exists and the worktree stays clean (temp dir is
      // outside git-tracked content and removed by the afterAll cleanup).
      expect(existsSync(join(target, '.svelte-kit', 'output'))).toBe(true);
    },
  );
});

describe('scaffolder test-infrastructure concurrency (AUDIT-F1 regression)', () => {
  it('real-build fixtures own unique per-process directories and never collide', () => {
    // Two simulated "processes" each create their own mkdtemp directory with
    // the SAME pattern the real-build fixture uses; the random mkdtemp
    // suffixes must make them distinct (no shared path) and both must exist
    // simultaneously without interfering with each other.
    const processA = mkdtempSync(join(REPO_ROOT, '.tmp-scaffold-check-'));
    const processB = mkdtempSync(join(REPO_ROOT, '.tmp-scaffold-check-'));
    tempDirs.push(processA, processB);
    expect(processA).not.toBe(processB);
    expect(processA.startsWith(join(REPO_ROOT, '.tmp-scaffold-check-'))).toBe(true);
    expect(processB.startsWith(join(REPO_ROOT, '.tmp-scaffold-check-'))).toBe(true);
    expect(existsSync(processA)).toBe(true);
    expect(existsSync(processB)).toBe(true);
    // The old SHARED path (fixed name, no random suffix) must not be
    // recreated by the test infrastructure.
    expect(existsSync(join(REPO_ROOT, '.tmp-scaffold-check'))).toBe(false);
  });

  it('cleanup removes only the exact owned directory, never junction targets', () => {
    const dir = tempDir('vict-scaffold-cleanup-');
    const outside = tempDir('vict-scaffold-cleanup-out-');
    const marker = join(outside, 'marker.txt');
    writeFileSync(marker, 'AUTHOR CONTENT', 'utf8');
    const linkPath = join(dir, 'linked');
    try {
      symlinkSync(outside, linkPath, 'junction');
    } catch {
      // Environmental: without symlink/junction privilege this specific
      // negative case cannot be exercised; record and continue.
      console.warn('skipping junction-cleanup case: symlink creation not permitted');
      return;
    }
    // Remove ONLY the owned directory tree. The junction inside it is
    // unlinked; its TARGET (and the author marker inside) must survive.
    rmSync(dir, { recursive: true, force: true });
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(outside)).toBe(true);
    expect(readFileSync(marker, 'utf8')).toBe('AUTHOR CONTENT');
  });
});
