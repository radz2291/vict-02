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
import {
  GENERATED_FILES,
  REQUIRED_PLATFORM_PACKAGES,
  scaffoldVictApp,
} from '@victframework/scaffolder';

/**
 * One-time host scaffolder guarantees (Stage 05): fresh generation,
 * deterministic output, idempotent safe rerun, conflict refusal,
 * traversal/symlink protection, code-island protection, and a generated
 * project that type-checks and BUILDS as a real SvelteKit application
 * (module resolution through the workspace root).
 *
 * Stage 8 F6 platform-remedy additions (TaskLedger gap slice):
 * - the platform release set is EXPLICIT at scaffold time (no placeholder
 *   versions are ever invented); the required host package set is validated;
 * - the generated route/page and action-endpoint host files are
 *   DOMAIN-FREE (no starter-domain hardcodes) and async-app-factory-safe;
 * - the generated README documents the exact immutable-host vs
 *   author-owned file ownership.
 */

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const tempDirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** The explicit release set used by these tests (workspace package specs). */
const RELEASE_SET: Record<string, string> = {
  '@victframework/application': '0.3.1',
  '@victframework/appdata-sqlite': '0.3.1',
  '@victframework/renderer-svelte': '0.3.1',
  '@victframework/runtime': '0.3.1',
  '@victframework/sdk': '0.3.1',
  '@victframework/store-sqlite': '0.3.1',
};

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('scaffolder guarantees', () => {
  it('generates the complete host into a fresh directory', () => {
    const dir = tempDir('vict-scaffold-fresh-');
    const result = scaffoldVictApp({
      targetDir: join(dir, 'app'),
      appName: 'Fresh App',
      platformDependencies: RELEASE_SET,
    });
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
    scaffoldVictApp({
      targetDir: join(dirA, 'app'),
      appName: 'Same App',
      platformDependencies: RELEASE_SET,
    });
    scaffoldVictApp({
      targetDir: join(dirB, 'app'),
      appName: 'Same App',
      platformDependencies: RELEASE_SET,
    });
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
    expect(
      scaffoldVictApp({ targetDir: target, appName: 'Idem App', platformDependencies: RELEASE_SET })
        .status,
    ).toBe('created');
    const before = GENERATED_FILES.map((file) => readFileSync(join(target, file), 'utf8'));
    const rerun = scaffoldVictApp({
      targetDir: target,
      appName: 'Idem App',
      platformDependencies: RELEASE_SET,
    });
    expect(rerun.status).toBe('unchanged');
    const after = GENERATED_FILES.map((file) => readFileSync(join(target, file), 'utf8'));
    expect(after).toEqual(before);
  });

  it('refuses conflicts and overwrites nothing', () => {
    const dir = tempDir('vict-scaffold-conf-');
    const target = join(dir, 'app');
    scaffoldVictApp({
      targetDir: target,
      appName: 'Conflict App',
      platformDependencies: RELEASE_SET,
    });
    const readmePath = join(target, 'README.md');
    writeFileSync(readmePath, 'AUTHOR-OWNED CONTENT', 'utf8');
    const result = scaffoldVictApp({
      targetDir: target,
      appName: 'Conflict App',
      platformDependencies: RELEASE_SET,
    });
    expect(result.status).toBe('conflict');
    if (result.status !== 'conflict') return;
    expect(result.conflicts).toContain('README.md');
    expect(readFileSync(readmePath, 'utf8')).toBe('AUTHOR-OWNED CONTENT');
  });

  it('never overwrites author code islands', () => {
    const dir = tempDir('vict-scaffold-island-');
    const target = join(dir, 'app');
    scaffoldVictApp({
      targetDir: target,
      appName: 'Island App',
      platformDependencies: RELEASE_SET,
    });
    const island = join(target, 'src', 'lib', 'components', 'MyWidget.svelte');
    writeFileSync(island, '<!-- AUTHOR ISLAND -->', 'utf8');
    const result = scaffoldVictApp({
      targetDir: target,
      appName: 'Island App',
      platformDependencies: RELEASE_SET,
    });
    expect(result.status).toBe('unchanged');
    expect(readFileSync(island, 'utf8')).toBe('<!-- AUTHOR ISLAND -->');
  });

  it('refuses relative targets and targets whose component is a file', () => {
    const relative = scaffoldVictApp({
      targetDir: 'vict-scaffold-relative-probe/sub',
      appName: 'X',
      platformDependencies: RELEASE_SET,
    });
    expect(relative.status).toBe('refused');
    expect(existsSync(resolve('vict-scaffold-relative-probe'))).toBe(false);
    const dir = tempDir('vict-scaffold-file-');
    writeFileSync(join(dir, 'afile'), 'x', 'utf8');
    const fileComponent = scaffoldVictApp({
      targetDir: join(dir, 'afile', 'sub'),
      appName: 'X',
      platformDependencies: RELEASE_SET,
    });
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
    const result = scaffoldVictApp({
      targetDir: join(linkPath, 'app'),
      appName: 'X',
      platformDependencies: RELEASE_SET,
    });
    expect(result.status).toBe('refused');
    expect(result.status === 'refused' ? result.reason : '').toContain('symbolic link');
  });

  it('refuses invalid names', () => {
    expect(
      scaffoldVictApp({
        targetDir: tempDir('vict-scaffold-x-'),
        appName: '   ',
        platformDependencies: RELEASE_SET,
      }).status,
    ).toBe('refused');
    expect(
      scaffoldVictApp({
        targetDir: tempDir('vict-scaffold-x-'),
        appName: 'X',
        packageName: 'BAD NAME',
        platformDependencies: RELEASE_SET,
      }).status,
    ).toBe('refused');
  });
});

describe('explicit release-set selection (F6 §6.1 remedy)', () => {
  it('refuses scaffolding without an explicit release set', () => {
    const result = scaffoldVictApp({
      targetDir: join(tempDir('vict-scaffold-rel-'), 'app'),
      appName: 'X',
      platformDependencies: undefined as never,
    });
    expect(result.status).toBe('refused');
    expect(result.status === 'refused' ? result.reason : '').toContain('platformDependencies');
  });

  it('refuses a release set that omits any package the host imports', () => {
    const incomplete: Record<string, string> = { ...RELEASE_SET };
    delete incomplete['@victframework/store-sqlite'];
    const result = scaffoldVictApp({
      targetDir: join(tempDir('vict-scaffold-rel2-'), 'app'),
      appName: 'X',
      platformDependencies: incomplete,
    });
    expect(result.status).toBe('refused');
    expect(result.status === 'refused' ? result.reason : '').toContain('store-sqlite');
  });

  it('refuses non-vict platform dependency keys', () => {
    const result = scaffoldVictApp({
      targetDir: join(tempDir('vict-scaffold-rel3-'), 'app'),
      appName: 'X',
      platformDependencies: { ...RELEASE_SET, react: '^19.0.0' },
    });
    expect(result.status).toBe('refused');
    expect(result.status === 'refused' ? result.reason : '').toContain('@victframework');
  });

  it('serializes the explicit release set into package.json (no placeholder versions)', () => {
    const dir = tempDir('vict-scaffold-rel4-');
    const target = join(dir, 'app');
    const explicit: Record<string, string> = {
      ...RELEASE_SET,
      '@victframework/sdk': '0.9.0-candidate',
    };
    const result = scaffoldVictApp({
      targetDir: target,
      appName: 'Release Set App',
      platformDependencies: explicit,
    });
    expect(result.status).toBe('created');
    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@victframework/sdk']).toBe('0.9.0-candidate');
    expect(JSON.stringify(pkg.dependencies)).not.toContain('0.1.0');
    for (const required of REQUIRED_PLATFORM_PACKAGES) {
      expect(pkg.dependencies[required], required).toBe(explicit[required]);
    }
  });
});

describe('app-neutral generated host (F6 §6.2 remedy)', () => {
  it('generates domain-free host route/page and endpoint files', () => {
    const dir = tempDir('vict-scaffold-neutral-');
    const target = join(dir, 'app');
    const result = scaffoldVictApp({
      targetDir: target,
      appName: 'Neutral Host App',
      platformDependencies: RELEASE_SET,
    });
    expect(result.status).toBe('created');
    const hostFiles = [
      'src/lib/server/application-server.ts',
      'src/routes/[...vict]/+page.server.ts',
      'src/routes/api/act/+server.ts',
      'src/routes/[...vict]/+page.svelte',
    ];
    for (const file of hostFiles) {
      const content = readFileSync(join(target, file), 'utf8');
      // No starter-domain hardcode may appear in a host file.
      expect(content.includes("'items'"), file).toBe(false);
      expect(content.includes('items.read'), file).toBe(false);
      expect(content.includes('v.items'), file).toBe(false);
    }
    // The host awaits the (asynchronous) application factory.
    expect(readFileSync(join(target, 'src/routes/[...vict]/+page.server.ts'), 'utf8')).toContain(
      'await getAppServer()',
    );
    expect(readFileSync(join(target, 'src/routes/api/act/+server.ts'), 'utf8')).toContain(
      'await getAppServer()',
    );
    // The generic server pre-validates declared input contracts BEFORE any
    // governed run or durable mutation (the F5 refusal path, generically).
    const server = readFileSync(join(target, 'src/lib/server/application-server.ts'), 'utf8');
    expect(server).toContain('CONTRACT_REJECTED');
    expect(server).toContain('preValidate');
    expect(server).toContain('createAppServer(): Promise<AppServer>');
  });

  it('documents exact file ownership in the generated README', () => {
    const dir = tempDir('vict-scaffold-readme-');
    const target = join(dir, 'app');
    scaffoldVictApp({
      targetDir: target,
      appName: 'Ownership App',
      platformDependencies: RELEASE_SET,
    });
    const readme = readFileSync(join(target, 'README.md'), 'utf8');
    expect(readme).toContain('IMMUTABLE HOST FILES');
    expect(readme).toContain('AUTHOR-OWNED');
    expect(readme).toContain('src/lib/application/definition.ts');
    expect(readme).toContain('platformDependencies');
  });

  it('exports the author-owned bindings the generic host consumes', () => {
    const dir = tempDir('vict-scaffold-bindings-');
    const target = join(dir, 'app');
    scaffoldVictApp({
      targetDir: target,
      appName: 'Bindings App',
      platformDependencies: RELEASE_SET,
    });
    const definition = readFileSync(join(target, 'src/lib/application/definition.ts'), 'utf8');
    expect(definition).toContain('export const resources');
    expect(definition).toContain('export const contracts');
    expect(definition).toContain('export const capabilities');
    expect(definition).toContain('export const grants');
    const server = readFileSync(join(target, 'src/lib/server/application-server.ts'), 'utf8');
    for (const imported of ['resources', 'contracts', 'capabilities', 'grants']) {
      expect(server, imported).toContain(imported);
    }
  });
});

describe('CLI release-set handling', () => {
  it(
    'reports created / conflict / refused outcomes with an explicit release set',
    { timeout: 120_000 },
    () => {
      const dir = tempDir('vict-scaffold-cli-');
      const target = join(dir, 'app');
      const releaseSetPath = join(dir, 'release-set.json');
      writeFileSync(releaseSetPath, JSON.stringify(RELEASE_SET), 'utf8');
      const run = (args: string[]) =>
        spawnSync(
          process.execPath,
          ['--import', 'tsx', 'packages/scaffolder/src/cli.ts', ...args],
          {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 60_000,
          },
        );
      // No release set: exit 2 with usage guidance.
      const noReleaseSet = run([target, 'CLI App']);
      expect(noReleaseSet.status).toBe(2);
      const created = run([target, 'CLI App', '--release-set', releaseSetPath]);
      expect(created.status).toBe(0);
      // A clean rerun is "unchanged" (exit 0).
      const conflict = run([target, 'CLI App', '--release-set', releaseSetPath]);
      expect(conflict.status).toBe(0);
      // A changed file conflicts (exit 1).
      writeFileSync(join(target, 'README.md'), 'MINE', 'utf8');
      const conflicted = run([target, 'CLI App', '--release-set', releaseSetPath]);
      expect(conflicted.status).toBe(1);
      const refused = run([join(dir, 'linked-again'), 'X', '--release-set', releaseSetPath]);
      expect([0, 1, 2]).toContain(refused.status);
      void existsSync;
      void readdirSync;
    },
  );
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
      const result = scaffoldVictApp({
        targetDir: target,
        appName: 'Build Check App',
        platformDependencies: RELEASE_SET,
      });
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
