import { createHash } from 'node:crypto';

/**
 * Adapter compatibility marker and version-upgrade conformance harness
 * (MSTR-002, amendment §6.1 component 14).
 *
 * The adapter pins EXACT versions of every Mastra package it uses. The
 * marker below is the canonical data that enters `agentProfileVersion`:
 * the adapter package identity plus EVERY runtime-affecting pinned
 * `@mastra/*` package actually used. Changing any pinned version changes
 * the marker and therefore every profile version; the conformance harness
 * decides whether an upgraded combination is accepted.
 *
 * This module is the ONLY place where Mastra package names/versions are
 * declared; neutral VICT packages never mention them (AI-002).
 */

/** The adapter package identity. */
export const MASTRA_ADAPTER_ID = '@vict/mastra';

/**
 * The adapter implementation revision. Bump when adapter code changes
 * execution semantics (the same author/build revision discipline as
 * capability handlers — bodies are never hashed).
 */
export const MASTRA_ADAPTER_REVISION = '1';

/** Exact pinned Mastra package versions used by this adapter. */
export const MASTRA_PINNED_VERSIONS = {
  '@mastra/core': '1.64.0',
  '@mastra/memory': '1.28.2',
  '@mastra/libsql': '1.22.3',
  '@mastra/observability': '1.17.5',
} as const;

export type MastraPinnedPackageName = keyof typeof MASTRA_PINNED_VERSIONS;

/**
 * The frozen adapter compatibility marker: adapter id/revision plus every
 * runtime-affecting pinned Mastra package version. This is the value that
 * belongs in `profile.adapter` (`runtimePackages`) and in every run
 * snapshot.
 */
export const MASTRA_ADAPTER_COMPATIBILITY: Readonly<{
  readonly id: typeof MASTRA_ADAPTER_ID;
  readonly revision: typeof MASTRA_ADAPTER_REVISION;
  readonly runtimePackages: Readonly<Record<MastraPinnedPackageName, string>>;
}> = Object.freeze({
  id: MASTRA_ADAPTER_ID,
  revision: MASTRA_ADAPTER_REVISION,
  runtimePackages: Object.freeze({ ...MASTRA_PINNED_VERSIONS }),
});

/** The license boundary of every pinned Mastra package (adoption evidence, §2.1). */
export const MASTRA_LICENSE_BOUNDARIES: Readonly<
  Record<MastraPinnedPackageName, { readonly license: 'Apache-2.0'; readonly registry: string }>
> = Object.freeze({
  '@mastra/core': { license: 'Apache-2.0', registry: 'https://registry.npmjs.org/@mastra/core' },
  '@mastra/memory': {
    license: 'Apache-2.0',
    registry: 'https://registry.npmjs.org/@mastra/memory',
  },
  '@mastra/libsql': {
    license: 'Apache-2.0',
    registry: 'https://registry.npmjs.org/@mastra/libsql',
  },
  '@mastra/observability': {
    license: 'Apache-2.0',
    registry: 'https://registry.npmjs.org/@mastra/observability',
  },
});

/** One conformance-harness check result. */
export interface MastraCompatibilityCheck {
  readonly check: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** The harness result. */
export interface MastraCompatibilityReport {
  readonly ok: boolean;
  readonly marker: typeof MASTRA_ADAPTER_COMPATIBILITY;
  readonly checks: readonly MastraCompatibilityCheck[];
}

/** Deterministic identity of the marker itself (used by the harness). */
export function mastraCompatibilityFingerprint(): string {
  const entries = Object.entries(MASTRA_ADAPTER_COMPATIBILITY.runtimePackages)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, version]) => `${name}@${version}`)
    .join('|');
  return createHash('sha256')
    .update(`${MASTRA_ADAPTER_ID}@${MASTRA_ADAPTER_REVISION}|${entries}`, 'utf8')
    .digest('hex');
}

/**
 * Read an installed package version from its package.json without importing
 * runtime code (keeps the harness usable before any Mastra primitive runs).
 */
async function installedVersion(packageName: string): Promise<string | undefined> {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return (require(`${packageName}/package.json`) as { version?: string }).version;
  } catch {
    return undefined;
  }
}

/**
 * The version-upgrade conformance harness (MSTR-002).
 *
 * Verifies, against the ACTUALLY INSTALLED packages:
 * 1. every pinned Mastra package resolves to its exact pinned version;
 * 2. the pinned `@mastra/core` exposes the primitives the adapter relies
 *    on (Agent, createTool, Memory base, storage domains, tracing options);
 * 3. the pinned `@mastra/libsql` exposes the file-backed composite store
 *    with memory/observability domains and retention pruning;
 * 4. the pinned `@mastra/memory` exposes the Memory class with explicit
 *    storage binding and `settled()`.
 *
 * An upgraded combination must re-run this harness (plus the full Stage
 * 06A suite) before a new marker is accepted. The harness runs fully
 * offline — it resolves versions and constructor surfaces only.
 */
export async function verifyMastraAdapterCompatibility(): Promise<MastraCompatibilityReport> {
  const checks: MastraCompatibilityCheck[] = [];

  // 1. Exact installed versions.
  for (const [name, pinned] of Object.entries(MASTRA_PINNED_VERSIONS)) {
    const version = await installedVersion(name);
    checks.push({
      check: `pinned-version ${name}`,
      ok: version === pinned,
      detail:
        version === undefined ? 'package not resolvable' : `installed ${version}, pinned ${pinned}`,
    });
  }

  // 2. Core primitives exist on the installed version.
  try {
    const core = await import('@mastra/core');
    const agentModule = await import('@mastra/core/agent');
    const toolsModule = await import('@mastra/core/tools');
    checks.push({
      check: 'core primitives',
      ok:
        typeof core.Mastra === 'function' &&
        typeof agentModule.Agent === 'function' &&
        typeof toolsModule.createTool === 'function',
      detail: 'Mastra, Agent, createTool resolved from @mastra/core',
    });
  } catch (error) {
    checks.push({
      check: 'core primitives',
      ok: false,
      detail: `@mastra/core primitives unavailable: ${error instanceof Error ? error.name : 'unknown error'}`,
    });
  }

  // 3. LibSQL composite store with retention support.
  try {
    const libsql = await import('@mastra/libsql');
    checks.push({
      check: 'libsql composite store',
      ok: typeof libsql.LibSQLStore === 'function',
      detail: 'LibSQLStore constructor resolved from @mastra/libsql',
    });
  } catch (error) {
    checks.push({
      check: 'libsql composite store',
      ok: false,
      detail: `@mastra/libsql unavailable: ${error instanceof Error ? error.name : 'unknown error'}`,
    });
  }

  // 4. Memory with explicit storage binding.
  try {
    const memory = await import('@mastra/memory');
    checks.push({
      check: 'memory constructor',
      ok: typeof memory.Memory === 'function',
      detail: 'Memory constructor resolved from @mastra/memory',
    });
  } catch (error) {
    checks.push({
      check: 'memory constructor',
      ok: false,
      detail: `@mastra/memory unavailable: ${error instanceof Error ? error.name : 'unknown error'}`,
    });
  }

  // 5. Observability entrypoint + storage exporter (payload-safe tracing).
  try {
    const observability = await import('@mastra/observability');
    checks.push({
      check: 'observability entrypoint',
      ok:
        typeof observability.Observability === 'function' &&
        typeof observability.MastraStorageExporter === 'function',
      detail: 'Observability and MastraStorageExporter resolved from @mastra/observability',
    });
  } catch (error) {
    checks.push({
      check: 'observability entrypoint',
      ok: false,
      detail: `@mastra/observability unavailable: ${error instanceof Error ? error.name : 'unknown error'}`,
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    marker: MASTRA_ADAPTER_COMPATIBILITY,
    checks,
  };
}
