/**
 * Bootstrap placeholder ARTIFACT tests (release-readiness r4).
 *
 * The r3 bootstrap stripped `dist` from the temp copy — but
 * `@victframework/ui` publishes ONLY `dist` (files: ["dist"]), so its
 * placeholder tarball would have violated its own manifest (zero
 * exportable files). r4 builds the member in the real workspace, copies
 * faithfully, re-versions ONLY the temp manifest, and validates the
 * ACTUAL `npm pack --dry-run` tarball against the manifest.
 *
 * These tests run REAL builds and REAL dry-run packs (no registry write,
 * no artifact persisted) and would FAIL on r3 (dist missing from the
 * candidate; no validation existed).
 */
import { describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBootstrapCandidate, validateBootstrapCandidate } from '../lib/bootstrap-pack.mjs';
import { BOOTSTRAP_PLACEHOLDER_VERSION } from '../lib/trust-preflight.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const COORDINATED_VERSION = '0.4.0-rc.1';

describe('bootstrap placeholder artifact — ui (publishes dist ONLY)', { timeout: 600_000 }, () => {
  const candidate = buildBootstrapCandidate({ repoRoot, name: '@victframework/ui' });
  it.afterAll(() => rmSync(candidate.workDir, { recursive: true, force: true }));

  it('the tarball contains the built dist (the r3 process dropped it)', () => {
    expect(candidate.fileList).toContain('package.json');
    expect(candidate.fileList).toContain('dist/index.js');
    expect(candidate.fileList).toContain('dist/index.d.ts');
  });

  it('every declared export/main/types target exists in the tarball', () => {
    expect(candidate.problems).toEqual([]);
    expect(candidate.manifest.exports['.'].default).toBe('./dist/index.js');
    expect(candidate.manifest.exports['.'].types).toBe('./dist/index.d.ts');
    expect(candidate.manifest.main).toBe('./dist/index.js');
  });

  it('the temp manifest is re-versioned to the placeholder; nothing else changes', () => {
    expect(candidate.manifest.version).toBe(BOOTSTRAP_PLACEHOLDER_VERSION);
    expect(candidate.manifest.name).toBe('@victframework/ui');
    expect(candidate.sourceManifest.version).toBe(COORDINATED_VERSION);
    expect(candidate.sourceManifest.version).not.toBe(candidate.manifest.version);
  });

  it('is truthfully a registry-presence marker: no dependencies, never latest', () => {
    // ui has no dependencies, so the placeholder itself installs — but
    // its PURPOSE remains registry presence (trust configuration), not
    // consumption: fixed 0.0.0-bootstrap.1 version under `bootstrap`.
    expect(candidate.manifest.dependencies).toBeUndefined();
    expect(BOOTSTRAP_PLACEHOLDER_VERSION).toMatch(/^0\.0\.0-bootstrap\.\d+$/);
  });
});

describe(
  'bootstrap placeholder artifact — ui-svelte (deps pin the UNPUBLISHED coordinated version)',
  { timeout: 600_000 },
  () => {
    const candidate = buildBootstrapCandidate({ repoRoot, name: '@victframework/ui-svelte' });
    it.afterAll(() => rmSync(candidate.workDir, { recursive: true, force: true }));

    it('ships its source exports AND the declaration-only dist', () => {
      expect(candidate.problems).toEqual([]);
      expect(candidate.fileList).toContain('src/index.ts');
      expect(candidate.fileList).toContain('src/styles.css');
      expect(candidate.fileList.some((path) => path.startsWith('dist/'))).toBe(true);
    });

    it('every one of the declared export targets exists in the tarball', () => {
      const exportCount = Object.keys(candidate.manifest.exports).length;
      expect(exportCount).toBeGreaterThan(40);
      expect(candidate.problems).toEqual([]);
    });

    it('is NOT installable before the coordinated set publishes — by design, truthfully', () => {
      expect(candidate.problems).toEqual([]);
      const deps = candidate.manifest.dependencies ?? {};
      const pinned = Object.entries(deps).filter(([, spec]) => spec === COORDINATED_VERSION);
      expect(pinned.length).toBeGreaterThanOrEqual(3); // application, sdk, ui
      // The dependency pins stay VERBATIM (the placeholder does not lie
      // about what the real package needs), which is exactly why
      // dependency resolution fails until the coordinated set publishes.
      expect(deps['@victframework/application']).toBe(COORDINATED_VERSION);
      expect(deps['@victframework/sdk']).toBe(COORDINATED_VERSION);
      expect(deps['@victframework/ui']).toBe(COORDINATED_VERSION);
      expect(BOOTSTRAP_PLACEHOLDER_VERSION).not.toBe(COORDINATED_VERSION);
    });
  },
);

describe('validateBootstrapCandidate — tamper detection', () => {
  it('a missing dist entry (the r3 defect) is caught against the manifest', () => {
    const problems = validateBootstrapCandidate({
      name: '@victframework/ui',
      sourceManifest: {
        name: '@victframework/ui',
        files: ['dist'],
        exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
        main: './dist/index.js',
      },
      manifest: {
        name: '@victframework/ui',
        version: BOOTSTRAP_PLACEHOLDER_VERSION,
        exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
        main: './dist/index.js',
      },
      fileList: ['package.json', 'README.md', 'src/index.ts'], // no dist — the r3 state
    });
    expect(problems.join('\n')).toContain("'./dist/index.js' is MISSING");
    expect(problems.join('\n')).toContain("'./dist/index.d.ts' is MISSING");
    expect(problems.join('\n')).toContain("files' entry 'dist' is missing");
  });

  it('dependency mutation or workspace-protocol leakage is caught', () => {
    const problems = validateBootstrapCandidate({
      name: '@x/y',
      sourceManifest: { name: '@x/y', dependencies: { a: '1.0.0' } },
      manifest: {
        name: '@x/y',
        version: BOOTSTRAP_PLACEHOLDER_VERSION,
        dependencies: { a: 'workspace:*' },
      },
      fileList: ['package.json'],
    });
    expect(problems.join('\n')).toContain("'dependencies' was mutated");
    expect(problems.join('\n')).toContain('workspace:*');
  });
});
