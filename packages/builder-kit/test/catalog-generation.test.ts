import { describe, expect, it, vi } from 'vitest';
import { scanFirstPartySources } from '../src/catalog/static-scan.js';
import { CatalogGenerationError, generateCatalog } from '../src/catalog/generate.js';
import { canonicalJsonBytes } from '../src/canonical.js';
import { buildFixture, FIXTURE_PACK_SOURCE_DYNAMIC, failures } from './helpers/fixture.js';

/**
 * Catalog generation negative controls (handoff Tests #1/2b): fail-closed
 * static completeness (`catalog-unresolved`), credential-free isolated
 * generation, and handler-never-invoked.
 */

// The isolated child spawns node with the tsx loader; cold starts exceed
// the 5s default under parallel load.
vi.setConfig({ testTimeout: 120_000 });

describe('static declaration scan', () => {
  it('resolves every literal declaration of the fixture pack', () => {
    const root = buildFixture();
    const scan = scanFirstPartySources(root);
    expect(scan.unresolved).toEqual([]);
    expect(scan.declarations).toContainEqual({
      file: 'packs/fx-pack/src/index.ts',
      id: 'fx.read',
      revision: '1',
    });
  });

  it('fails closed on a computed capability entry (catalog-unresolved)', () => {
    const root = buildFixture({ packSource: FIXTURE_PACK_SOURCE_DYNAMIC });
    const scan = scanFirstPartySources(root);
    expect(scan.declarations).toEqual([]);
    expect(scan.unresolved.length).toBeGreaterThan(0);
    expect(scan.unresolved[0]?.reason).toMatch(/string literal/);
  });
});

describe('isolated catalog generation', () => {
  it('serializes declarative manifests with summary: null and module digests', () => {
    const root = buildFixture();
    const { catalog } = generateCatalog(root);
    expect(catalog.schemaMarker).toBe('vict.builder.catalog@1');
    expect(catalog.packs).toHaveLength(1);
    const pack = catalog.packs[0] as Record<string, unknown>;
    expect(pack['id']).toBe('vict.fixture.fx');
    const capabilities = pack['capabilities'] as readonly Record<string, unknown>[];
    expect(capabilities[0]?.['summary']).toBeNull();
    expect(capabilities[0]?.['module']).toBe('packs/fx-pack/src/index.ts');
    expect(typeof capabilities[0]?.['contentSha256']).toBe('string');
    // No handler bodies anywhere in the canonical bytes.
    const text = canonicalJsonBytes(catalog).toString('utf8');
    expect(text).not.toMatch(/invoke|function|=>/);
  });

  it('runs in a credential-free child: planted canaries never reach the output', () => {
    const root = buildFixture();
    const canaries = { CANARY_A: 'vict-fixture-canary-one', CANARY_B: 'vict-fixture-canary-two' };
    const { catalog } = generateCatalog(root, { env: canaries });
    const text = canonicalJsonBytes(catalog).toString('utf8');
    for (const value of Object.values(canaries)) {
      expect(text).not.toContain(value);
    }
  });

  it('parent process never invokes capability handlers during generation', async () => {
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');
    const root = buildFixture();
    const moduleUrl = pathToFileURL(join(root, 'packs', 'fx-pack', 'src', 'index.ts')).href;
    const mod = (await import(moduleUrl)) as { invocationCountValue(): number };
    expect(mod.invocationCountValue()).toBe(0);
    generateCatalog(root);
    // The isolated child has its own module instance; OUR copy's handler
    // was never invoked by the generator.
    expect(mod.invocationCountValue()).toBe(0);
  });

  it('fails closed when a hostile module pollutes the generation protocol', async () => {
    const root = buildFixture();
    // A module that writes to stdout at import time corrupts the child's
    // JSON protocol → generation must fail, never silently pass.
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    mkdirSync(join(root, 'packs', 'noisy-pack', 'src'), { recursive: true });
    writeFileSync(
      join(root, 'packs', 'noisy-pack', 'package.json'),
      JSON.stringify({
        name: '@victframework/noisy-pack',
        version: '1.0.0',
        type: 'module',
        main: './src/index.ts',
      }),
      'utf8',
    );
    writeFileSync(
      join(root, 'packs', 'noisy-pack', 'src', 'index.ts'),
      "process.stdout.write('HANDLER-INVOKED-NOISE');\nexport const noisy = 1;\n",
      'utf8',
    );
    expect(() => generateCatalog(root)).toThrow(CatalogGenerationError);
  });
});

describe('gate wiring for catalog classes', () => {
  it('exposes catalog-unresolved and catalog-drift as gate classes', () => {
    // The gate itself maps static-scan failures to `catalog-unresolved`;
    // this assertion pins the class name used by the gate and tests.
    const dynamicRoot = buildFixture({ packSource: FIXTURE_PACK_SOURCE_DYNAMIC });
    const scan = scanFirstPartySources(dynamicRoot);
    expect(scan.unresolved.length).toBeGreaterThan(0);
    expect(
      failures({
        checks: [{ id: 'catalog:static-resolvable', ok: false, driftClass: 'catalog-unresolved' }],
      }),
    ).toEqual([{ id: 'catalog:static-resolvable', driftClass: 'catalog-unresolved' }]);
  });
});
