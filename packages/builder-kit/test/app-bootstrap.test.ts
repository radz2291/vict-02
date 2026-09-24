import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_PACK_PATH, buildAppPackFromPaths } from '../src/generate/app-pack.js';

/**
 * External-app bootstrap test (handoff WP-1: `init-app` generates
 * `BUILDER-KIT.md` + the app-local base pack; the generated bootstrap's
 * mandated freshness command `verify --app` must exist and hold).
 *
 * This exercises the PACKED kit artifact (`npm pack` tarball) installed
 * into an empty temporary external project — the path must not depend on
 * the VICT checkout. It is a bootstrap test, NOT the TaskLedger P2 proof.
 */

const KIT_DIR = fileURLToPath(new URL('..', import.meta.url));
const VICT_CHECKOUT = fileURLToPath(new URL('../../..', import.meta.url));

let workspace = '';
let appDir = '';
let kitTgz = '';
let kitTgzName = '';
let kitTgzSha = '';

function run(cliArgs: readonly string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const bin = join(
    appDir,
    'node_modules',
    '@victframework',
    'builder-kit',
    'bin',
    'vict-builder-kit.mjs',
  );
  const result = spawnSync(process.execPath, [bin, ...cliArgs], { cwd: appDir, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function verifyAppCli(): { status: number | null; stdout: string } {
  return run(['verify', '--app', '--app-dir', '.']);
}

describe('external-app bootstrap from the packed kit artifact', () => {
  beforeAll(() => {
    workspace = mkdtempSync(join(tmpdir(), 'vict-kit-app-'));
    const vendor = join(workspace, 'vendor');
    mkdirSync(vendor, { recursive: true });

    // Build the kit from source, then pack the built artifact and its runtime
    // dependencies from the checkout (offline determinism).
    execSync(`npm run build`, { cwd: KIT_DIR, stdio: 'pipe' });
    execSync(`npm pack --pack-destination "${vendor}"`, { cwd: KIT_DIR, stdio: 'pipe' });
    execSync(`npm pack --pack-destination "${vendor}"`, {
      cwd: join(VICT_CHECKOUT, 'node_modules', 'typescript'),
      stdio: 'pipe',
    });
    execSync(`npm pack --pack-destination "${vendor}"`, {
      cwd: join(VICT_CHECKOUT, 'node_modules', 'tsx'),
      stdio: 'pipe',
    });
    const tarballs = execSync(`ls "${vendor}"`, { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'));
    kitTgzName = tarballs.find((name) => name.startsWith('victframework-builder-kit-')) ?? '';
    expect(kitTgzName).not.toBe('');
    kitTgz = join(vendor, kitTgzName);
    kitTgzSha = createHash('sha256').update(readFileSync(kitTgz)).digest('hex');

    // Empty external project (outside the checkout): minimal package.json + one source file.
    appDir = join(workspace, 'external-app');
    mkdirSync(join(appDir, 'src'), { recursive: true });
    writeFileSync(
      join(appDir, 'package.json'),
      JSON.stringify({ name: 'victim-external-app', version: '0.1.0', private: true }, null, 2) +
        '\n',
      'utf8',
    );
    writeFileSync(join(appDir, 'src', 'index.ts'), 'export const answer = 42;\n', 'utf8');

    // Install the packed kit artifact + deps into the external project.
    const deps = tarballs
      .filter((name) => name !== kitTgzName)
      .map((name) => `"${join(vendor, name)}"`)
      .join(' ');
    execSync(`npm install --no-audit --no-fund --ignore-scripts "${kitTgz}" ${deps}`, {
      cwd: appDir,
      stdio: 'pipe',
    });
    expect(
      existsSync(join(appDir, 'node_modules', '@victframework', 'builder-kit', 'dist', 'index.js')),
    ).toBe(true);
  }, 240_000);

  afterAll(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('init-app writes the bootstrap AND the app-local base pack, bound together', () => {
    const result = run([
      'init-app',
      '--app-dir',
      '.',
      '--release-set',
      'vict-release-set@1/0.3.1',
      '--kit-artifact',
      kitTgzName,
      '--kit-sha256',
      kitTgzSha,
      '--input',
      'package.json',
      '--input',
      'src/index.ts',
    ]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(existsSync(join(appDir, 'BUILDER-KIT.md'))).toBe(true);
    expect(existsSync(join(appDir, APP_PACK_PATH))).toBe(true);

    const pack = JSON.parse(readFileSync(join(appDir, APP_PACK_PATH), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(pack['schemaMarker']).toBe('vict.builder.app-pack@1');
    const generatedFrom = pack['generatedFrom'] as Record<string, unknown>;
    expect(generatedFrom['releaseSetId']).toBe('vict-release-set@1/0.3.1');
    const bootstrap = readFileSync(join(appDir, 'BUILDER-KIT.md'), 'utf8');
    expect(bootstrap).toContain('verify --app');
    expect(bootstrap).toContain(pack['packId'] as string);

    // Checkout independence: neither generated artifact references the VICT checkout.
    const packBytes = readFileSync(join(appDir, APP_PACK_PATH), 'utf8');
    const checkoutMarker = VICT_CHECKOUT.endsWith(sep) ? VICT_CHECKOUT.slice(0, -1) : VICT_CHECKOUT;
    expect(packBytes.includes(checkoutMarker)).toBe(false);
    expect(bootstrap.includes(checkoutMarker)).toBe(false);
  }, 60_000);

  it('verify --app is green on a freshly bootstrapped project', () => {
    const result = verifyAppCli();
    expect(result.stdout).toContain('ALL CHECKS PASSED');
    expect(result.status).toBe(0);
  }, 60_000);

  it('tampering with a recorded input fails the gate with a stable class', () => {
    const source = join(appDir, 'src', 'index.ts');
    writeFileSync(source, readFileSync(source, 'utf8') + '// tampered\n', 'utf8');
    const result = verifyAppCli();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('content-drift');
    expect(result.stdout).toContain('src/index.ts');

    // Restore the recorded bytes: the gate returns green (deterministic, content-addressed).
    writeFileSync(source, 'export const answer = 42;\n', 'utf8');
    expect(verifyAppCli().status).toBe(0);
  }, 60_000);

  it('tampering with the pack identity fails closed and is restorable', () => {
    const packPath = join(appDir, APP_PACK_PATH);
    const original = readFileSync(packPath, 'utf8');
    const pack = JSON.parse(original) as Record<string, unknown>;
    const tamperedId = (pack['packId'] as string).replace(/[0-9a-f]$/, (c) =>
      c === '0' ? '1' : '0',
    );
    writeFileSync(packPath, original.replace(pack['packId'] as string, tamperedId), 'utf8');
    const result = verifyAppCli();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('pack-tamper');

    writeFileSync(packPath, original, 'utf8');
    expect(verifyAppCli().status).toBe(0);
  }, 60_000);

  it('the generator is deterministic and path-safe', () => {
    const first = buildAppPackFromPaths(appDir, {
      appName: 'victim-external-app',
      appVersion: '0.1.0',
      releaseSetId: 'vict-release-set@1/0.3.1',
      kitArtifactSpec: kitTgzName,
      kitArtifactSha256: kitTgzSha,
      inputPaths: ['src/index.ts', 'package.json'],
    });
    const committed = JSON.parse(readFileSync(join(appDir, APP_PACK_PATH), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(first.packId).toBe(committed['packId']);
    expect(() =>
      buildAppPackFromPaths(appDir, {
        appName: 'x',
        appVersion: '0.1.0',
        releaseSetId: 'vict-release-set@1/0.3.1',
        kitArtifactSpec: kitTgzName,
        kitArtifactSha256: kitTgzSha,
        inputPaths: ['../outside.txt'],
      }),
    ).toThrow(/safe app-relative/);
  }, 60_000);
});
